"""Adapt local validation schemas to provider-side constrained generation."""


def native_schema(value):
    """Keep local checks intact without constraining natural text to one glyph.

    JSON Schema `pattern` uses search semantics. Some compatible endpoints
    compile it as a full-match grammar, so the local nonblank check `\\S`
    permits just one character there. Omit only that check on the wire;
    Pydantic still rejects blank text after generation. Anchored ID patterns,
    lengths, enums, required fields and object constraints remain enforced.
    """
    if isinstance(value, dict):
        return {
            key: native_schema(item)
            for key, item in value.items()
            if key not in {"x-domain", "discriminator", "$schema"}
            and not (key == "pattern" and item == r"\S")
        }
    if isinstance(value, list):
        return [native_schema(item) for item in value]
    return value
