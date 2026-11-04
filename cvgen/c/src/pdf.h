/* PDF 1.4 writer for one-column-of-text documents: the standard Helvetica fonts, one JPEG
   image and uncompressed content streams. */
#ifndef CV_PDF_H
#define CV_PDF_H

#include "common.h"

#define PDF_MAX_PAGES 8
#define PAGE_WIDTH 595.28f /* A4 in points */
#define PAGE_HEIGHT 841.89f

typedef enum { FONT_REGULAR, FONT_BOLD, FONT_ITALIC, FONT_COUNT } Font;

typedef struct {
    float r, g, b;
} Color;

typedef struct {
    const unsigned char *data;
    size_t len;
    int width, height, components;
} Jpeg;

typedef struct {
    Buf pages[PDF_MAX_PAGES]; /* content streams */
    int npages;
    const Jpeg *image; /* available on every page as /Im1 */
} Pdf;

bool jpeg_load(Arena *arena, const char *path, Jpeg *jpeg, char *err, size_t errlen);

Buf *pdf_add_page(Pdf *pdf); /* NULL when PDF_MAX_PAGES is reached */
void pdf_text(Buf *page, Font font, float size, Color color, float x, float y, const char *winansi);
void pdf_image(Buf *page, float x, float y, float width, float height);
void pdf_dotted_line(Buf *page, Color color, float x, float top, float bottom, float width);
bool pdf_save(const Pdf *pdf, const char *path, char *err, size_t errlen);
void pdf_free(Pdf *pdf);

/* Advance width of WinAnsi text in points (metrics.c). */
float text_width(Font font, const char *winansi, float size);

#endif
