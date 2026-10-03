// Returns "ja" for text containing kana or CJK ideographs, for the lang attribute.
export const langOf = (text: string): "ja" | undefined =>
  /[　-ヿ一-鿿]/.test(text) ? "ja" : undefined;
