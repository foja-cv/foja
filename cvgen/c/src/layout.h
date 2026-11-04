/* Places a Cv on A4 pages: a sidebar with the photo on the first page and a main column
   that flows onto new pages when needed. */
#ifndef CV_LAYOUT_H
#define CV_LAYOUT_H

#include "cv.h"
#include "pdf.h"

bool layout_cv(Arena *arena, const Cv *cv, const Jpeg *photo, Pdf *pdf, char *err, size_t errlen);

#endif
