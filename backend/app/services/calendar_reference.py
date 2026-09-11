"""Conservative calendar arithmetic hints; never infer tasks or rewrite model data."""
from datetime import date
import re

DATE = r"(?:(\d{4})年)?(\d{1,2})月(\d{1,2})日"
RANGE = re.compile(DATE + r"\s*(?:至|到)\s*" + DATE)


def calendar_reference(source: str) -> list[dict]:
    """Resolve explicit Chinese date ranges only when the year is unambiguous.

    Unknown years, invalid dates and implicit year rollovers get no hint. Both
    inclusive and exclusive day counts are supplied: source semantics, task
    identity, milestone placement and dependency intent remain the model's job.
    """
    years = {int(year) for year in re.findall(r"(?<!\d)(\d{4})年", source)}
    implicit_year = next(iter(years)) if len(years) == 1 else None
    results = []
    seen = set()
    for match in RANGE.finditer(source):
        y1, m1, d1, y2, m2, d2 = match.groups()
        # With multiple years in the source, require both endpoints explicitly.
        start_year = int(y1) if y1 else implicit_year
        end_year = int(y2) if y2 else implicit_year
        if start_year is None or end_year is None:
            continue
        try:
            start, end = date(start_year, int(m1), int(d1)), date(end_year, int(m2), int(d2))
        except ValueError:
            continue
        if end < start or match.group() in seen:
            continue
        seen.add(match.group())
        days = (end - start).days
        results.append({"原文日期段": match.group(), "日期差": days, "包含首尾当天的天数": days + 1})
    return results
