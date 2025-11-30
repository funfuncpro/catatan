export namespace Actor {
  export type ElementId = [string, number] | null;

  export interface Permission {
    write: boolean;
  }

  export interface Cursor {
    after_element: ElementId;
    offset: number;
    color?: string;
  }

  export interface Writer {
    id: string;
    name: string;
    permission: Permission;
    cursor: Cursor;
  }
  export type WritersMap = Record<string, Writer>;
}
