import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { EmptyInvitation } from "../src/ui/EmptyInvitation";

it("keeps preset controls without decorative empty-state prose", () => {
  const markup = renderToStaticMarkup(
    createElement(EmptyInvitation, { onPreset: () => {} }),
  );

  expect(markup).toContain(">Cloud forest</button>");
  expect(markup).toContain(">Alpine creek</button>");
  expect(markup).not.toMatch(/<h[1-6]\b|<p\b|eyebrow/);
  expect(markup).not.toMatch(/little life|SMALL BEGINNING|find a home/);
});
