import { parse } from 'csv-parse/sync';
import { config } from '../config.js';
import { ApiError } from '../utils/ApiError.js';

/** Parse an uploaded CSV buffer into { headers, rows } with sensible limits. */
export function parseCsv(buffer) {
  let records;
  try {
    records = parse(buffer, {
      bom: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });
  } catch (err) {
    throw ApiError.badRequest(`Could not parse CSV: ${err.message}`);
  }

  if (records.length < 2) {
    throw ApiError.badRequest('The CSV needs a header row and at least one data row');
  }

  const rawHeaders = records[0];
  if (rawHeaders.length > config.upload.maxColumns) {
    throw ApiError.badRequest(`Too many columns (max ${config.upload.maxColumns})`);
  }
  if (records.length - 1 > config.upload.maxRows) {
    throw ApiError.badRequest(`Too many rows (max ${config.upload.maxRows})`);
  }

  // Name blank headers and make duplicates unique so every column is addressable
  const seen = new Map();
  const headers = rawHeaders.map((h, i) => {
    const base = h && h.length ? h : `column_${i + 1}`;
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}_${count + 1}`;
  });

  const width = headers.length;
  const rows = records.slice(1).map((r) => {
    const row = r.slice(0, width);
    while (row.length < width) row.push('');
    return row;
  });

  return { headers, rows };
}
