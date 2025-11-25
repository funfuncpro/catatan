import { TextStyle } from "./type";
import { FONT_SIZE, FONT_FAMILY } from "./constant";

export const buildFont = (style: TextStyle): string => {
  const weight = style.bold ? "bold" : "normal";
  const fontStyle = style.italic ? "italic" : "normal";
  const family = style.code ? "monospace" : FONT_FAMILY;
  return `${fontStyle} ${weight} ${FONT_SIZE}px ${family}`;
};
