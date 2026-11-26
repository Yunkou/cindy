/**
 * Pi 用 `readFile(path, "utf-8")` 解码 models.json。写盘显式给字节：Node 的
 * `fs.writeFile(string)` 本来就按 UTF-8 写，但这一层仍然把编码钉死，并拒绝 UTF-8
 * 无法表示的文本（孤立代理项会被静默替换成 U+FFFD）——宁可这次写失败，也不落一份
 * 被改写过的清单。
 *
 * 注意：这一步不能修复「名字在上游就已经是错的」（#12928）。若传入的字符串里已经是
 * 「路」(U+8DEF)，编码后写出的就是 E8 B7 AF，往返校验会如实通过。定位那种损坏要用
 * `countManifestCodePoints` 的码点统计，见那里的说明。
 */
export function encodeManifestUtf8(content: string, label: string): Buffer {
  const bytes = Buffer.from(content, 'utf8');
  if (bytes.toString('utf8') !== content) {
    throw new Error(`[PI_MANIFEST_NOT_UTF8] ${label} contains text that UTF-8 cannot represent byte-for-byte`);
  }
  return bytes;
}

/**
 * 清单里所有非 ASCII 字符的码点计数（#12928 的定位自检）。
 *
 * 只记录十进制码点与出现次数，**不记录字符本身**：这条统计存在的场景正是编码可能已被
 * 搞坏的时候，把字符打进日志可能再被同一种问题改写一次。
 *
 * 用法：写盘前打一条 debug。读回来的统计决定往哪边查：
 *  - `U+8DEF`（「路」）有计数 → 清单写出来之前名字就已经错了，往上游取名链路查；
 *  - 只有 `U+00B7`（「·」）→ 写前是对的，损坏在写出或读取环节。
 * 判据是码点而不是"两个名字是否相等"，所以不会把合法的中文模型名当成异常。
 */
export function countManifestCodePoints(content: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const char of content) {
    const codePoint = char.codePointAt(0)!;
    if (codePoint <= 0x7f) continue;
    const key = `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}
