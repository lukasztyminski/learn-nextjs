'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import postgres from 'postgres';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

const FormSchema = z.object({
  id: z.string().min(1),
  customerId: z
    .string({
      invalid_type_error: 'Please select a customer',
    })
    .min(1, { message: 'Please select a customer' }),
  amount: z.coerce
    .number()
    .gt(0, { message: 'Please enter an amount greater than $0.' }),
  status: z.enum(['pending', 'paid'], {
    errorMap: () => ({ message: 'Please select an invoice status' }),
  }),
  date: z.string().min(1),
});

type ErrorsField = {
  customerId?: string[];
  amount?: string[];
  status?: string[];
};

export type State = {
  errors?: ErrorsField;
  message?: string | null;
  values?: { customerId?: string; amount?: string; status?: string };
};

const CreateInvoice = FormSchema.omit({ id: true, date: true });

export async function createInvoice(prevState: State, formData: FormData) {
  const rawValues = {
    customerId: (formData.get('customerId') as string) ?? '',
    amount: (formData.get('amount') as string) ?? '',
    status: (formData.get('status') as string) ?? '',
  };
  const validateFields = CreateInvoice.safeParse(rawValues);

  if (!validateFields.success) {
    return {
      errors: validateFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Create Invoice.',
      values: rawValues,
    };
  }

  const { customerId, amount, status } = validateFields.data;

  const amountInCents = amount * 100;
  const date = new Date().toISOString().split('T')[0];

  try {
    await sql`
      INSERT INTO invoices (customer_id, amount, status, date)
      VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
    `;
  } catch (error) {
    return {
      message: 'Database Error: Failed to Create Invoice.',
      values: rawValues,
    };
  }

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export async function updateInvoice(
  id: string,
  prevState: State,
  formData: FormData
) {
  const rawValues = {
    customerId: (formData.get('customerId') as string) ?? '',
    amount: (formData.get('amount') as string) ?? '',
    status: (formData.get('status') as string) ?? '',
  };
  const validateFields = UpdateInvoice.safeParse(rawValues);

  if (!validateFields.success) {
    return {
      errors: validateFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Update Invoice.',
      values: rawValues,
    };
  }

  const { customerId, amount, status } = validateFields.data;

  const amountInCents = amount * 100;

  try {
    await sql`
    UPDATE invoices
    SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
    WHERE id = ${id}
  `;
  } catch (error) {
    return {
      message: 'Database Error: Failed to Update Invoice.',
      values: rawValues,
    };
  }

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {
  await sql`DELETE FROM invoices WHERE id = ${id}`;
  revalidatePath('/dashboard/invoices');
}
