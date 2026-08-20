# Critical Thinking in Academic Research — a reading apparatus

A static site that carries the full text of Gruwell and Ewing's open textbook,
with search, the glossary, term distributions, every chapter attribution, and a
dialogue bound to passages of the book.

This book is an open educational resource under CC BY-SA 4.0, so redistribution
and adaptation are exactly what the licence permits — and there is nothing for
the reader to supply.

Source: *Critical Thinking in Academic Research — Second Edition* © 2022 by
Cindy Gruwell and Robin Ewing, Minnesota State Colleges and Universities,
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), except where
otherwise noted — <https://minnstate.pressbooks.pub/ctar2/>

## What is here

- **The whole book**, twelve parts and 91 chapters, with the printed page
  numbers kept so a passage can be cited.
- **Full-text search** across everything, naming the chapter and page on each
  hit.
- **The glossary**, 90 terms in the authors' own definitions.
- **Vocabulary**: the 220 most frequent content words and their spread across
  the parts, with log-likelihood keyness per part.
- **Attributions**: each part's own statement of source, author and licence,
  reproduced because the licence requires it.
- **A dialogue** that answers only from passages retrieved from the text, names
  the chapter, and declines to go past what the book says.

## What is not here

The book's **45 interactive H5P exercises** — the knowledge checks — cannot be
reproduced in a static page and are excluded from the print export this was
built from. Every one is linked to its place on Pressbooks from the chapter it
belongs to, so none is silently dropped. Images and diagrams are likewise not
reproduced.

## Deployment

Netlify, straight from this repository. No build step, no dependencies, no
third-party requests: `netlify.toml` publishes the root and picks up
`netlify/functions/`.

```
python -m http.server 8000     # then open http://localhost:8000
```

Everything except the dialogue works locally and offline; reading and search are
pure browser work over `data/text.json`. The dialogue needs Anthropic
credentials, which Netlify's **AI Gateway** injects on a logged-in, credit-based
account — enable it under *Project configuration → AI Gateway*. Without it the
rest is unaffected.

## Notes on the extraction

Built from the Pressbooks print export (August 2025): 223 PDF pages, structure
from the file's own bookmarks, printed page numbers from the footer.

Two things needed care and are documented on the site's *Method* page. The
typesetting scatters spaces inside words — the title page reads `CIND Y GRUW
ELL` — which is repaired against the book's own vocabulary rather than by rule.
And the glossary is printed as alternating lines of term and definition with no
typographic distinction that survives extraction; it is parsed on two signals
together, alphabetical order and strict alternation, because either alone breaks
on a short definition that happens to sort after the term before it.

## Licensing

See [LICENSES.md](LICENSES.md). In short: the text and everything derived from
it are **CC BY-SA 4.0**, as they must be; the code is MIT.

Independent project, not endorsed by the authors or by Minnesota State.
