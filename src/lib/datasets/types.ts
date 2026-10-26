export type ColumnType = "text" | "number" | "date";

export interface Column {
  name: string;
  type: ColumnType;
  /** A blank value in a required column rejects the row. */
  required: boolean;
}

/** Numbers are parsed, dates are ISO `YYYY-MM-DD`, text is trimmed. Blank values are null. */
export type Cell = string | number | null;

export interface Dataset {
  name: string;
  columns: Column[];
  rows: Cell[][];
}
