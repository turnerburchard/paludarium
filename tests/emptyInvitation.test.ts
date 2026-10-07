import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { EmptyInvitation } from "../src/ui/EmptyInvitation";

it("invites an animal into an empty habitat without assuming its species", () => {
  const markup = renderToStaticMarkup(
    createElement(EmptyInvitation, { onPreset: () => {} }),
  );

  expect(markup).toContain("then find a home for a creature.");
  expect(markup).not.toMatch(/\bfrogs?\b/i);
});
