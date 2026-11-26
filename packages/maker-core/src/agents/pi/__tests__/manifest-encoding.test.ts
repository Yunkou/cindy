import { describe, expect, it } from 'vitest';

import { encodeManifestUtf8 } from '../manifest-encoding.js';

// 测试价值
// - 生产入口与可观察结果：encodeManifestUtf8 —— Pi 清单写盘前把 JSON 文本变成的字节。
// - Bug／规则依据：#12928 —— Windows 代码页 936 下「·」(U+00B7) 的 UTF-8 字节 C2 B7
//   与「路」的 GBK 字节相同，一次按代码页的解码就会把模型显示名改写成「路」。
// - 现有覆盖缺口：pi-provider-routing.test.ts 的清单断言覆盖正常写入，覆盖不到「文本
//   无法按 UTF-8 表示」这条失败分支。
// - 最小失败输入：`·`（必须是 C2 B7，不能是「路」的 E8 B7 AF）；孤立代理项 U+D800
//   （Buffer 会静默替换成 U+FFFD，必须改为抛错）。
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
