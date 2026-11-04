#include "pdf.h"

#include <stdio.h>
#include <string.h>

static const char *const BASE_FONTS[FONT_COUNT] = {"Helvetica", "Helvetica-Bold",
                                                   "Helvetica-Oblique"};

static bool fail(char *err, size_t errlen, const char *message, const char *path) {
    snprintf(err, errlen, "%s: %s", message, path);
    return false;
}

bool jpeg_load(Arena *arena, const char *path, Jpeg *jpeg, char *err, size_t errlen) {
    size_t len;
    const unsigned char *d = (const unsigned char *)read_file(arena, path, &len);
    if (d == NULL) return fail(err, errlen, "cannot read the photo", path);
    if (len < 4 || d[0] != 0xFF || d[1] != 0xD8) return fail(err, errlen, "not a JPEG", path);

    size_t i = 2;
    while (i + 4 <= len) {
        if (d[i] != 0xFF) break;
        unsigned char marker = d[i + 1];
        if (marker == 0xFF) { /* fill byte */
            i++;
            continue;
        }
        if (marker == 0x01 || (marker >= 0xD0 && marker <= 0xD8)) { /* no length */
            i += 2;
            continue;
        }
        size_t segment = (size_t)d[i + 2] << 8 | d[i + 3];
        bool frame = marker >= 0xC0 && marker <= 0xCF && marker != 0xC4 && marker != 0xC8 &&
                     marker != 0xCC;
        if (frame) {
            if (segment < 8 || i + 2 + segment > len) break;
            jpeg->height = d[i + 5] << 8 | d[i + 6];
            jpeg->width = d[i + 7] << 8 | d[i + 8];
            jpeg->components = d[i + 9];
            if (jpeg->components != 1 && jpeg->components != 3)
                return fail(err, errlen, "only grayscale and RGB JPEGs are supported", path);
            jpeg->data = d;
            jpeg->len = len;
            return true;
        }
        i += 2 + segment;
    }
    return fail(err, errlen, "corrupt JPEG or no frame header", path);
}

Buf *pdf_add_page(Pdf *pdf) {
    if (pdf->npages == PDF_MAX_PAGES) return NULL;
    return &pdf->pages[pdf->npages++];
}

void pdf_text(Buf *page, Font font, float size, Color color, float x, float y,
              const char *winansi) {
    buf_printf(page, "BT /F%d %.2f Tf %.3f %.3f %.3f rg %.2f %.2f Td (", (int)font + 1, size,
               color.r, color.g, color.b, x, y);
    for (const unsigned char *p = (const unsigned char *)winansi; *p != '\0'; p++) {
        if (*p == '(' || *p == ')' || *p == '\\') buf_printf(page, "\\%c", *p);
        else if (*p < 32 || *p > 126) buf_printf(page, "\\%03o", *p);
        else buf_append(page, p, 1);
    }
    buf_printf(page, ") Tj ET\n");
}

void pdf_image(Buf *page, float x, float y, float width, float height) {
    buf_printf(page, "q %.2f 0 0 %.2f %.2f %.2f cm /Im1 Do Q\n", width, height, x, y);
}

void pdf_dotted_line(Buf *page, Color color, float x, float top, float bottom, float width) {
    /* Zero-length dashes with round caps draw as dots. */
    buf_printf(page, "q %.3f %.3f %.3f RG %.2f w 1 J [0 %.2f] 0 d %.2f %.2f m %.2f %.2f l S Q\n",
               color.r, color.g, color.b, width, width * 3, x, top, x, bottom);
}

bool pdf_save(const Pdf *pdf, const char *path, char *err, size_t errlen) {
    FILE *out = fopen(path, "wb");
    if (out == NULL) return fail(err, errlen, "cannot write", path);

    enum { CATALOG = 1, PAGES = 2, FIRST_FONT = 3 };
    int image = pdf->image ? FIRST_FONT + FONT_COUNT : 0;
    int first_page = FIRST_FONT + FONT_COUNT + (pdf->image ? 1 : 0);
    int count = first_page + 2 * pdf->npages;
    long offsets[FIRST_FONT + FONT_COUNT + 1 + 2 * PDF_MAX_PAGES];

    fputs("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", out);
    offsets[CATALOG] = ftell(out);
    fprintf(out, "%d 0 obj\n<< /Type /Catalog /Pages %d 0 R >>\nendobj\n", CATALOG, PAGES);

    offsets[PAGES] = ftell(out);
    fprintf(out, "%d 0 obj\n<< /Type /Pages /Count %d /Kids [", PAGES, pdf->npages);
    for (int i = 0; i < pdf->npages; i++) fprintf(out, " %d 0 R", first_page + 2 * i);
    fputs(" ] >>\nendobj\n", out);

    for (int f = 0; f < FONT_COUNT; f++) {
        offsets[FIRST_FONT + f] = ftell(out);
        fprintf(out,
                "%d 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /%s"
                " /Encoding /WinAnsiEncoding >>\nendobj\n",
                FIRST_FONT + f, BASE_FONTS[f]);
    }

    if (pdf->image) {
        const Jpeg *jpeg = pdf->image;
        offsets[image] = ftell(out);
        fprintf(out,
                "%d 0 obj\n<< /Type /XObject /Subtype /Image /Width %d /Height %d"
                " /ColorSpace /%s /BitsPerComponent 8 /Filter /DCTDecode /Length %zu >>\nstream\n",
                image, jpeg->width, jpeg->height,
                jpeg->components == 1 ? "DeviceGray" : "DeviceRGB", jpeg->len);
        fwrite(jpeg->data, 1, jpeg->len, out);
        fputs("\nendstream\nendobj\n", out);
    }

    for (int i = 0; i < pdf->npages; i++) {
        int page = first_page + 2 * i, contents = page + 1;
        offsets[page] = ftell(out);
        fprintf(out,
                "%d 0 obj\n<< /Type /Page /Parent %d 0 R /MediaBox [0 0 %.2f %.2f]"
                " /Resources << /Font <<",
                page, PAGES, PAGE_WIDTH, PAGE_HEIGHT);
        for (int f = 0; f < FONT_COUNT; f++) fprintf(out, " /F%d %d 0 R", f + 1, FIRST_FONT + f);
        fputs(" >>", out);
        if (pdf->image) fprintf(out, " /XObject << /Im1 %d 0 R >>", image);
        fprintf(out, " >> /Contents %d 0 R >>\nendobj\n", contents);

        offsets[contents] = ftell(out);
        fprintf(out, "%d 0 obj\n<< /Length %zu >>\nstream\n", contents, pdf->pages[i].len);
        fwrite(pdf->pages[i].data, 1, pdf->pages[i].len, out);
        fputs("\nendstream\nendobj\n", out);
    }

    long xref = ftell(out);
    fprintf(out, "xref\n0 %d\n0000000000 65535 f \n", count);
    for (int i = 1; i < count; i++) fprintf(out, "%010ld 00000 n \n", offsets[i]);
    fprintf(out, "trailer\n<< /Size %d /Root %d 0 R >>\nstartxref\n%ld\n%%%%EOF\n", count,
            CATALOG, xref);

    bool failed = ferror(out) != 0;
    if (fclose(out) != 0) failed = true;
    return failed ? fail(err, errlen, "error while writing", path) : true;
}

void pdf_free(Pdf *pdf) {
    for (int i = 0; i < pdf->npages; i++) buf_free(&pdf->pages[i]);
    pdf->npages = 0;
}
