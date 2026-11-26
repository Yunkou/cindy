import { describe, expect, it } from 'vitest';

import { countManifestCodePoints, encodeManifestUtf8 } from '../manifest-encoding.js';

// 测试价值
// - 生产入口与可观察结果：encodeManifestUtf8 / countManifestCodePoints —— Pi 清单
//   写出的字节，以及写盘前后打给诊断用的码点统计。
// - Bug／规则依据：#12928 —— Windows 代码页 936 下「·」(U+00B7) 的 UTF-8 字节 C2 B7
//   恰是「路」的 GBK 字节，一次按代码页的解码就会把模型显示名改写成「路」。
// - 现有覆盖缺口：pi-provider-routing.test.ts 覆盖正常写入，覆盖不到「文本无法按
//   UTF-8 表示」的失败分支，也覆盖不到定位用的码点统计。
// - 最小失败输入：`·`（必须是 C2 B7，不能是「路」的 E8 B7 AF）；孤立代理项 U+D800
//   （Buffer 会静默替换成 U+FFFD，必须改为抛错）；含 U+8DEF 的名称。
// - tier：unit —— 纯函数，无 I/O、无子进程。

describe('pi manifest encoding', () => {
  it('writes a middle dot as C2 B7, never as the ANSI code page decode', () => {
    const bytes = encodeManifestUtf8('DeepSeek V4.1 Flash 1017 · OpenCode Go', 'models.json');
    expect(bytes.includes(Buffer.from([0xc2, 0xb7]))).toBe(true);
    // 「路」的 UTF-8 是 E8 B7 AF —— 按 936 解码再写回就会变成这样。
    expect(bytes.includes(Buffer.from([0xe8, 0xb7, 0xaf]))).toBe(false);
    expect(bytes.toString('utf8')).toBe('DeepSeek V4.1 Flash 1017 · OpenCode Go');
  });

  it('refuses to write text UTF-8 cannot represent instead of substituting U+FFFD', () => {
    expect(() => encodeManifestUtf8(String.fromCharCode(0xd800), 'models.json')).toThrow(/PI_MANIFEST_NOT_UTF8/);
  });
});

describe('pi manifest code point census', () => {
  it('counts a correct name as U+00B7 so a 936 host can tell which side broke it', () => {
    expect(countManifestCodePoints('1017 · OpenCode')).toEqual({ 'U+00B7': 1 });
  });

  it('reports U+8DEF with its count when the name was already corrupted upstream', () => {
    const corrupted = JSON.stringify({
      providers: { magpie: { models: [
        { name: 'A 路 B' }, { name: 'C 路 D' }, { name: 'E 路 F' },
      ] } },
    });
    const counts = countManifestCodePoints(corrupted);
    // The whole point of the census: 3 models, 3 corruptions, one number.
    expect(counts['U+8DEF']).toBe(3);
    expect(counts['U+00B7']).toBeUndefined();
  });

  it('records code points only, never the characters themselves', () => {
    const counts = countManifestCodePoints('模型·名称');
    expect(Object.keys(counts).every(key => /^U\+[0-9A-F]{4,}$/.test(key))).toBe(true);
    expect(JSON.stringify(counts)).not.toContain('·');
    expect(JSON.stringify(counts)).not.toContain('模');
  });

  it('ignores ASCII so the counts stay about the characters that can be rewritten', () => {
    expect(countManifestCodePoints('plain ascii only')).toEqual({});
  });
});
