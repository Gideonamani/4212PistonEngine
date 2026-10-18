"""The definitions the instructor has read and accepted, by definition id.

Everything else ships as a draft: the part card shows a "Draft text" chip until its definition is listed here. Add an id only after
the instructor has reviewed that definition (the review sheet is built by scripts/build_gtsio_part_review_sheet.py), then run
assemble.py --write and scripts/build_gtsio_part_details.mjs.
"""
REVIEWED = set()
