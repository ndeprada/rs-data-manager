import test from "node:test";
import assert from "node:assert/strict";
import { boardKeyAction } from "../src/lib/boardKeys.js";

const k = (code, o = {}) => ({ code, shiftKey: false, altKey: false, ctrlKey: false, metaKey: false, ...o });

test("atajos de herramientas como en FmStadio", () => {
  assert.equal(boardKeyAction(k("Digit0")), "ball");
  assert.equal(boardKeyAction(k("Digit2")), "team2");
  assert.equal(boardKeyAction(k("KeyA")), "arrow");
  assert.equal(boardKeyAction(k("KeyA", { altKey: true })), "cycleArrow");
  assert.equal(boardKeyAction(k("KeyD")), "zone");
  assert.equal(boardKeyAction(k("KeyE")), "text");
  assert.equal(boardKeyAction(k("KeyT")), "material");
  assert.equal(boardKeyAction(k("KeyN")), "addFrame");
  assert.equal(boardKeyAction(k("KeyM")), "removeFrame");
  assert.equal(boardKeyAction(k("Space")), "play");
  assert.equal(boardKeyAction(k("KeyH", { shiftKey: true })), "help");
});

test("flechas: mueven lo elegido o pasan de fotograma", () => {
  assert.equal(boardKeyAction(k("ArrowRight")), "nextFrame");
  assert.equal(boardKeyAction(k("ArrowUp")), "prevFrame");
  assert.equal(boardKeyAction(k("ArrowRight"), { hasSel: true }), "nudgeRight");
  assert.equal(boardKeyAction(k("ArrowLeft", { altKey: true })), "firstFrame");
});

test("deshacer, rehacer, borrar y lo que se deja al navegador", () => {
  assert.equal(boardKeyAction(k("KeyZ", { ctrlKey: true })), "undo");
  assert.equal(boardKeyAction(k("KeyZ", { metaKey: true, shiftKey: true })), "redo");
  assert.equal(boardKeyAction(k("KeyY", { ctrlKey: true })), "redo");
  assert.equal(boardKeyAction(k("Backspace")), null, "sin nada elegido no borra");
  assert.equal(boardKeyAction(k("Backspace"), { hasSel: true }), "delete");
  assert.equal(boardKeyAction(k("Delete", { shiftKey: true }), { hasSel: true }), "deleteHere");
  assert.equal(boardKeyAction(k("KeyC", { ctrlKey: true })), null, "copiar es del navegador");
  assert.equal(boardKeyAction(k("KeyP", { ctrlKey: true })), null);
});
