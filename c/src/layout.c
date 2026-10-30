#include "layout.h"

#include <stdio.h>
#include <string.h>

#define MARGIN 34.0f /* 1.2 cm */
#define SIDE_WIDTH 137.0f
#define GAP 13.0f
#define MAIN_X (MARGIN + SIDE_WIDTH + 2 * GAP)
#define MAIN_WIDTH (PAGE_WIDTH - MARGIN - MAIN_X)
#define TOP (PAGE_HEIGHT - MARGIN)
#define BULLET_INDENT 12.0f

static const Color BLUE = {0.0f, 0.5f, 1.0f}; /* RoyalBlue, as in the LaTeX template */
static const Color BLACK = {0.0f, 0.0f, 0.0f};
static const Color GREY = {0.3f, 0.3f, 0.3f};

typedef enum { ALIGN_LEFT, ALIGN_RIGHT } Align;

typedef struct {
    Font font;
    Color color;
    const char *text; /* UTF-8 */
} Span;

typedef struct {
    Font font;
    Color color;
    const char *word; /* WinAnsi */
    float width;
} Word;

typedef struct {
    Arena *arena;
    Pdf *pdf;
    Buf *page;
    float x, width, y;
    bool can_break; /* the sidebar stays on the first page */
    bool overflow;
} Column;

static void start_page(Buf *page) {
    pdf_dotted_line(page, BLUE, MARGIN + SIDE_WIDTH + GAP, TOP, MARGIN, 1.5f);
}

static void ensure_space(Column *col, float height) {
    if (col->y - height >= MARGIN) return;
    if (!col->can_break) {
        col->overflow = true;
        return;
    }
    Buf *page = pdf_add_page(col->pdf);
    if (page == NULL) {
        col->overflow = true;
        return;
    }
    start_page(page);
    col->page = page;
    col->y = TOP;
}

static size_t split_words(Column *col, const Span *spans, size_t nspans, float size, Buf *words) {
    for (size_t s = 0; s < nspans; s++) {
        const char *text = utf8_to_winansi(col->arena, spans[s].text);
        while (*text != '\0') {
            while (*text == ' ') text++;
            size_t len = strcspn(text, " ");
            if (len == 0) break;
            Word word = {spans[s].font, spans[s].color, arena_strndup(col->arena, text, len), 0};
            word.width = text_width(word.font, word.word, size);
            buf_append(words, &word, sizeof word);
            text += len;
        }
    }
    return words->len / sizeof(Word);
}

/* Word-wraps the spans into lines of `leading` height. `marker` (WinAnsi) is drawn before the
   first line, in the indent. */
static void flow(Column *col, const Span *spans, size_t nspans, float size, float leading,
                 float indent, Align align, const char *marker) {
    Buf buf = {0};
    size_t n = split_words(col, spans, nspans, size, &buf);
    const Word *words = (const Word *)buf.data;
    float space = text_width(FONT_REGULAR, " ", size);
    float available = col->width - indent;

    for (size_t i = 0; i < n;) {
        size_t j = i + 1;
        float line = words[i].width;
        while (j < n && line + space + words[j].width <= available)
            line += space + words[j++].width;

        ensure_space(col, leading);
        col->y -= leading;
        float baseline = col->y + (leading - size) / 2 + 0.22f * size;
        float x = align == ALIGN_RIGHT ? col->x + col->width - line : col->x + indent;
        if (marker != NULL && i == 0)
            pdf_text(col->page, FONT_REGULAR, size, BLUE, col->x + indent - BULLET_INDENT, baseline,
                     marker);
        for (size_t k = i; k < j; k++) {
            pdf_text(col->page, words[k].font, size, words[k].color, x, baseline, words[k].word);
            x += words[k].width + space;
        }
        i = j;
    }
    buf_free(&buf);
}

static void text_line(Column *col, Font font, Color color, float size, float leading,
                      Align align, const char *text) {
    Span span = {font, color, text};
    flow(col, &span, 1, size, leading, 0, align, NULL);
}

/* Title on the left and the period right-aligned on its first line. */
static void title_line(Column *col, Font font, Color color, float size, const char *title,
                       const char *period) {
    float leading = size * 1.3f;
    ensure_space(col, leading);
    const char *period_ansi = utf8_to_winansi(col->arena, period);
    float period_width = text_width(FONT_REGULAR, period_ansi, size - 1);
    float first_baseline = col->y - leading + (leading - size) / 2 + 0.22f * size;
    Buf *page = col->page;

    float full_width = col->width;
    if (period_width > 0) col->width -= period_width + 10;
    text_line(col, font, color, size, leading, ALIGN_LEFT, title);
    col->width = full_width;
    if (period_width > 0)
        pdf_text(page, FONT_REGULAR, size - 1, GREY, col->x + col->width - period_width,
                 first_baseline, period_ansi);
}

/* The heading in bold followed by the text. Returns the number of spans. */
static size_t item_spans(Column *col, const Item *item, Span spans[2]) {
    size_t n = 0;
    if (item->heading != NULL)
        spans[n++] = (Span){FONT_BOLD, BLACK, arena_printf(col->arena, "%s.", item->heading)};
    spans[n++] = (Span){FONT_REGULAR, BLACK, item->text};
    return n;
}

static void bullets(Column *col, const Item *items, size_t n) {
    for (size_t i = 0; i < n; i++) {
        Span spans[2];
        size_t nspans = item_spans(col, &items[i], spans);
        flow(col, spans, nspans, 9.5f, 12.0f, BULLET_INDENT, ALIGN_LEFT, "\x95");
    }
}

static void entry(Column *col, const Entry *e, bool compact) {
    ensure_space(col, 36);
    title_line(col, FONT_BOLD, compact ? BLACK : BLUE, compact ? 10.0f : 10.5f, e->title,
               e->period);
    if (e->place[0] != '\0') text_line(col, FONT_ITALIC, GREY, 9.0f, 11.5f, ALIGN_LEFT, e->place);
    if (e->note[0] != '\0') text_line(col, FONT_REGULAR, BLACK, 9.0f, 11.5f, ALIGN_LEFT, e->note);
    if (!compact) bullets(col, e->tasks, e->ntasks);
    col->y -= compact ? 4 : 6;
}

/* Entries as title, place and dates; items as paragraphs, all aligned to the right. */
static void side_section(Column *col, const Section *section) {
    text_line(col, FONT_BOLD, BLUE, 9.5f, 12.0f, ALIGN_RIGHT, section->title);
    for (size_t i = 0; i < section->nentries; i++) {
        const Entry *e = &section->entries[i];
        text_line(col, FONT_BOLD, BLACK, 9.0f, 11.5f, ALIGN_RIGHT, e->title);
        if (e->place[0] != '\0') text_line(col, FONT_ITALIC, GREY, 9.0f, 11.5f, ALIGN_RIGHT, e->place);
        if (e->period[0] != '\0')
            text_line(col, FONT_ITALIC, GREY, 9.0f, 11.5f, ALIGN_RIGHT, e->period);
        col->y -= 4;
    }
    for (size_t i = 0; i < section->nitems; i++) {
        Span spans[2];
        size_t nspans = item_spans(col, &section->items[i], spans);
        flow(col, spans, nspans, 9.0f, 11.5f, 0, ALIGN_RIGHT, NULL);
        col->y -= 4;
    }
    col->y -= 9;
}

static void sidebar(Column *col, const Cv *cv, const Jpeg *photo) {
    float height = col->width * (float)photo->height / (float)photo->width;
    pdf_image(col->page, col->x, col->y - height, col->width, height);
    col->y -= height + 16;
    for (size_t b = 0; b < cv->nside; b++) {
        const SideBlock *block = &cv->side[b];
        text_line(col, FONT_BOLD, BLUE, 9.5f, 12.0f, ALIGN_RIGHT, block->title);
        for (size_t i = 0; i < block->nlines; i++)
            text_line(col, FONT_REGULAR, BLACK, 9.0f, 11.5f, ALIGN_RIGHT, block->lines[i]);
        col->y -= 9;
    }
    for (size_t s = 0; s < cv->nsections; s++)
        if (cv->sections[s].side) side_section(col, &cv->sections[s]);
}

bool layout_cv(Arena *arena, const Cv *cv, const Jpeg *photo, Pdf *pdf, char *err,
               size_t errlen) {
    pdf->image = photo;
    Buf *first = pdf_add_page(pdf);
    start_page(first);

    Column side = {arena, pdf, first, MARGIN, SIDE_WIDTH, TOP, false, false};
    sidebar(&side, cv, photo);
    if (side.overflow) {
        snprintf(err, errlen, "the sidebar does not fit on one page");
        return false;
    }

    Column main = {arena, pdf, first, MAIN_X, MAIN_WIDTH, TOP, true, false};
    text_line(&main, FONT_BOLD, BLUE, 24.0f, 28.0f, ALIGN_LEFT, cv->name);
    main.y -= 2;
    text_line(&main, FONT_BOLD, BLACK, 14.0f, 18.0f, ALIGN_LEFT, cv->subtitle);
    main.y -= 8;
    Span profile[2] = {{FONT_BOLD, BLUE, "Perfil"}, {FONT_REGULAR, BLACK, cv->profile}};
    flow(&main, profile, 2, 9.5f, 12.5f, 0, ALIGN_LEFT, NULL);
    main.y -= 12;

    for (size_t s = 0; s < cv->nsections; s++) {
        const Section *section = &cv->sections[s];
        if (section->side) continue;
        ensure_space(&main, 60); /* keep the heading with its first entry */
        text_line(&main, FONT_BOLD, BLACK, 13.0f, 17.0f, ALIGN_LEFT, section->title);
        main.y -= 3;
        for (size_t i = 0; i < section->nentries; i++)
            entry(&main, &section->entries[i], section->compact);
        bullets(&main, section->items, section->nitems);
        main.y -= 10;
    }
    if (main.overflow) {
        snprintf(err, errlen, "the CV needs more than %d pages", PDF_MAX_PAGES);
        return false;
    }
    return true;
}
