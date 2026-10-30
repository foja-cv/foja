/* Text helpers: the small Markdown subset of data/textos and UTF-8 to WinAnsi conversion. */
#ifndef CV_TEXT_H
#define CV_TEXT_H

#include "common.h"

typedef struct {
    const char *heading; /* NULL for text before the first heading or for plain list items */
    const char *text;
} Item;

/* `# Heading` lines start an item; the following non-empty lines are joined into its text. */
size_t md_parse(Arena *arena, const char *text, Item **items);

/* Copy without leading and trailing whitespace. */
char *trim(Arena *arena, const char *text);

/* Re-encode for the PDF standard fonts; characters outside WinAnsi become '?'. */
char *utf8_to_winansi(Arena *arena, const char *utf8);

#endif
