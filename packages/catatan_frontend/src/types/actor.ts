export namespace Actor {
  export interface Permission {
    write: boolean;
  }

  export interface Cursor {
    x: number;
    y: number;
  }

  export interface Writer {
    id: string;
    name: string;
    permission: Permission;
    cursor: Cursor;
  }

  /** Map of writer ID to Writer */
  export type WritersMap = Record<string, Writer>;
}
