export namespace Actor {
  export interface Writer {
    kind: "writer";
    id: string;
    name: string;
    color: string;
    cursor: {
      x: number;
      y: number;
    };
  }
}
