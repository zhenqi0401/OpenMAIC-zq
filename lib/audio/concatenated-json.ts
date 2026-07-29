/**
 * Split a stream body containing adjacent JSON objects. Braces inside JSON strings
 * are data, not structure; escaped quotes and backslashes are handled explicitly.
 */
export function splitConcatenatedJsonObjects(input: string): string[] {
  const objects: string[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let index = 0; index < input.length; index++) {
    const char = input[index];

    if (start < 0) {
      if (char === '{') {
        start = index;
        depth = 1;
      }
      continue;
    }

    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (inString && char === '\\') {
      escapeNext = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === '{') {
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth < 0) {
        throw new Error('Concatenated JSON contains an unmatched closing brace');
      }
      if (depth === 0) {
        objects.push(input.slice(start, index + 1));
        start = -1;
      }
    }
  }

  if (start >= 0) {
    throw new Error('Concatenated JSON ended with an incomplete object');
  }
  return objects;
}

export function parseConcatenatedJsonObjects<T>(input: string): T[] {
  return splitConcatenatedJsonObjects(input).map((object) => JSON.parse(object) as T);
}
