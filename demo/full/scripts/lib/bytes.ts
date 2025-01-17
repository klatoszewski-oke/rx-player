/**
 * Convert a string to an Uint8Array containing the corresponding UTF-16 code
 * units in little-endian.
 * @param {string} str
 * @returns {Uint8Array}
 */
export function strToLeUtf16(str: string): Uint8Array {
  const buffer = new ArrayBuffer(str.length * 2);
  const res = new Uint8Array(buffer);
  for (let i = 0; i < res.length; i += 2) {
    const value = str.charCodeAt(i / 2);
    res[i] = value & 0xFF;
    res[i + 1] = value >> 8 & 0xFF;
  }
  return res;
}

/**
 * Construct string from the little-endian UTF-16 code units given.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function leUtf16ToStr(bytes: Uint8Array): string {
  let str = "";
  for (let i = 0; i < bytes.length; i += 2) {
    str += String.fromCharCode((bytes[i + 1] << 8) + bytes[i]);
  }
  return str;
}

/**
 * Convert a string to an Uint8Array containing the corresponding UTF-8 code
 * units.
 * @param {string} str
 * @returns {Uint8Array}
 */
export function strToUtf8(str: string): Uint8Array {
  // http://stackoverflow.com/a/13691499 provides an ugly but functional solution.
  // (Note you have to dig deeper to understand it but I have more faith in
  // stackoverflow not going down in the future so I leave that link.)

  // Briefly said, `utf8Str` will contain a version of `str` where every
  // non-ASCII characters will be replaced by an escape sequence of the
  // corresponding representation of those characters in UTF-8.
  // It does sound weird and unnecessarily complicated, but it works!
  //
  // Here is actually what happens with more words. We will rely on two browser
  // APIs:
  //
  //   - `encodeURIComponent` will take a string and convert the non-ASCII
  //     characters in it into the percent-encoded version of the corresponding
  //     UTF-8 bytes
  //     Example: encodeURIComponent("é") => 0xC3 0xA9 => `"%C3%A9"`
  //
  //   - `unescape` unescapes (so far so good) a percent-encoded string. But it
  //     does it in a really simple way: percent-encoded byte by percent-encoded
  //     byte into the corresponding extended ASCII representation on 8 bits.
  //     As a result, we end-up with a string which actually contains instead of
  //     each of its original characters, the UTF-8 code units (8 bits) of
  //     those characters.
  //     Let's take our previous `"é" => "%C3%A9"` example. Here we would get:
  //     unecape("%C3%A9") => "\u00c3\u00a9" === "Ã©" (in extended ASCII)
  //
  // By iterating on the resulting string, we will then be able to generate a
  // Uint8Array containing the UTF-8 representation of that original string, by
  // just calling the charCodeAt API on it.
  let utf8Str;
  const pcStr = encodeURIComponent(str);

  // As "unescape" is a deprecated function we want to declare a fallback in the
  // case a browser decide to not implement it.
  if (typeof window.unescape === "function") {
    utf8Str = unescape(pcStr);
  } else {
    // simple unescape function
    // http://ecma-international.org/ecma-262/9.0/#sec-unescape-string
    const isHexChar = /[0-9a-fA-F]/;
    const pcStrLen = pcStr.length;
    utf8Str = "";
    for (let i = 0; i < pcStr.length; i++) {
      let wasPercentEncoded = false;
      if (pcStr[i] === "%") {
        if (i <= pcStrLen - 6 &&
            pcStr[i + 1] === "u" &&
            isHexChar.test(pcStr[i + 2]) &&
            isHexChar.test(pcStr[i + 3]) &&
            isHexChar.test(pcStr[i + 4]) &&
            isHexChar.test(pcStr[i + 5]))
        {
          const charCode = parseInt(pcStr.substring(i + 1, i + 6), 16);
          utf8Str += String.fromCharCode(charCode);
          wasPercentEncoded = true;
          i += 5; // Skip the next 5 chars
        } else if (i <= pcStrLen - 3 &&
            isHexChar.test(pcStr[i + 1]) &&
            isHexChar.test(pcStr[i + 2]))
        {
          const charCode = parseInt(pcStr.substring(i + 1, i + 3), 16);
          utf8Str += String.fromCharCode(charCode);
          wasPercentEncoded = true;
          i += 2; // Skip the next 2 chars
        }
      }
      if (!wasPercentEncoded) {
        utf8Str += pcStr[i];
      }
    }
  }

  // Now let's just build our array from every other bytes of that string's
  // UTF-16 representation
  const res = new Uint8Array(utf8Str.length);
  for (let i = 0; i < utf8Str.length; i++) {
    res[i] = utf8Str.charCodeAt(i) & 0xFF; // first byte should be 0x00 anyway
  }
  return res;
}

/**
 * Creates a new string from the given array of char codes.
 * @param {Uint8Array} args
 * @returns {string}
 */
export function stringFromCharCodes(args: Uint8Array): string {
  const max = 16000;
  let ret = "";
  for (let i = 0; i < args.length; i += max) {
    const subArray = args.subarray(i, i + max);
    ret += String.fromCharCode.apply(null, subArray as unknown as number[]);
  }
  return ret;
}

/**
 * Transform an integer into an hexadecimal string of the given length, padded
 * to the left with `0` if needed.
 * @example
 * ```
 * intToHex(5, 4); // => "0005"
 * intToHex(5, 2); // => "05"
 * intToHex(10, 1); // => "a"
 * intToHex(268, 3); // => "10c"
 * intToHex(4584, 6) // => "0011e8"
 * intToHex(123456, 4); // => "1e240" (we do nothing when going over 4 chars)
 * ```
 * @param {number} num
 * @param {number} size
 * @returns {string}
 */
function intToHex(num: number, size: number): string {
  const toStr = num.toString(16);
  return toStr.length >= size ?
    toStr :
    new Array(size - toStr.length + 1).join("0") + toStr;
}

/**
 * Creates a string from the given Uint8Array containing utf-8 code units.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function utf8ToStr(data: Uint8Array): string {
  let uint8 = data;

  // If present, strip off the UTF-8 BOM.
  if (uint8[0] === 0xEF && uint8[1] === 0xBB && uint8[2] === 0xBF) {
    uint8 = uint8.subarray(3);
  }

  // We're basically doing strToUtf8 in reverse.
  // You can look at that other function for the whole story.

  // Generate string containing escaped UTF-8 code units
  const utf8Str = stringFromCharCodes(uint8);

  let escaped;
  if (typeof window.escape !== "function") {
    // Transform UTF-8 escape sequence into percent-encoded escape sequences.
    escaped = escape(utf8Str);
  } else {
    // Let's implement a simple escape function
    // http://ecma-international.org/ecma-262/9.0/#sec-escape-string
    const nonEscapedChar = /[A-Za-z0-9*_+-./]/;
    escaped = "";
    for (let i = 0; i < utf8Str.length; i++) {
      if (nonEscapedChar.test(utf8Str[i])) {
        escaped += utf8Str[i];
      } else {
        const charCode = utf8Str.charCodeAt(i);
        escaped += charCode >= 256 ?
          "%u" + intToHex(charCode, 4) :
          "%" + intToHex(charCode, 2);
      }
    }
  }

  // Decode the percent-encoded UTF-8 string into the proper JS string.
  // Example: "g#%E3%82%AC" -> "g#€"
  return decodeURIComponent(escaped);
}
