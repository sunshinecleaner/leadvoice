import { parse } from "csv-parse";
import { prisma, LeadSource } from "@leadvoice/database";
import { Readable } from "stream";

interface CsvRow {
  firstName?: string;
  first_name?: string;
  lastName?: string;
  last_name?: string;
  phone: string;
  email?: string;
  company?: string;
  timezone?: string;
  notes?: string;
}

export async function importLeadsFromCsv(buffer: Buffer): Promise<{ imported: number; errors: string[] }> {
  const errors: string[] = [];
  const leads: Array<{
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
    company?: string;
    timezone?: string;
    notes?: string;
    source: LeadSource;
  }> = [];

  return new Promise((resolve, reject) => {
    const stream = Readable.from(buffer);
    const parser = stream.pipe(
      parse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }),
    );

    let row = 0;
    parser.on("data", (record: CsvRow) => {
      row++;
      const firstName = record.firstName || record.first_name || "";
      const lastName = record.lastName || record.last_name || "";
      const phone = record.phone?.trim();

      if (!phone) {
        errors.push(`Row ${row}: Missing phone number`);
        return;
      }
      if (!firstName) {
        errors.push(`Row ${row}: Missing first name`);
        return;
      }

      leads.push({
        firstName,
        lastName,
        phone,
        email: record.email || undefined,
        company: record.company || undefined,
        timezone: record.timezone || undefined,
        notes: record.notes || undefined,
        source: LeadSource.CSV,
      });
    });

    parser.on("error", reject);

    parser.on("end", async () => {
      if (leads.length > 0) {
        await prisma.lead.createMany({
          data: leads,
          skipDuplicates: true,
        });
      }
      resolve({ imported: leads.length, errors });
    });
  });
}
