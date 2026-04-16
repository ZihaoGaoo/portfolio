import {
  defineConfig,
  presetAttributify,
  presetIcons,
  presetUno,
  transformerDirectives,
  transformerVariantGroup,
  transformerAttributifyJsx
} from "unocss";
import akarIcons from "@iconify-json/akar-icons/icons.json";
import antDesignIcons from "@iconify-json/ant-design/icons.json";
import biIcons from "@iconify-json/bi/icons.json";
import bxIcons from "@iconify-json/bx/icons.json";
import charmIcons from "@iconify-json/charm/icons.json";
import faBrandsIcons from "@iconify-json/fa-brands/icons.json";
import faSolidIcons from "@iconify-json/fa-solid/icons.json";
import feIcons from "@iconify-json/fe/icons.json";
import gameIcons from "@iconify-json/game-icons/icons.json";
import ggIcons from "@iconify-json/gg/icons.json";
import heroiconsSolidIcons from "@iconify-json/heroicons-solid/icons.json";
import icIcons from "@iconify-json/ic/icons.json";
import iconParkOutlineIcons from "@iconify-json/icon-park-outline/icons.json";
import ionIcons from "@iconify-json/ion/icons.json";
import jamIcons from "@iconify-json/jam/icons.json";
import laIcons from "@iconify-json/la/icons.json";
import makiIcons from "@iconify-json/maki/icons.json";
import materialSymbolsIcons from "@iconify-json/material-symbols/icons.json";
import mdiIcons from "@iconify-json/mdi/icons.json";
import octiconIcons from "@iconify-json/octicon/icons.json";
import phIcons from "@iconify-json/ph/icons.json";
import riIcons from "@iconify-json/ri/icons.json";
import simpleIcons from "@iconify-json/simple-icons/icons.json";
import tablerIcons from "@iconify-json/tabler/icons.json";

const colorReg = (prefix: string) => new RegExp("^" + prefix + "-([0-9a-z]+)(/(\\d+))?$");

const colorAttr = (prefix: string, [, color, , opacity]: RegExpMatchArray) => {
  let lightColor = "",
    darkColor = "";

  if (["black", "white"].includes(color)) {
    lightColor = color;
    darkColor = color === "white" ? "black" : "white";
  } else {
    lightColor = `gray-${color}`;
    darkColor = `gray-${(
      (+color === 900 || +color === 50 ? 950 : 900) - +color
    ).toString()}`;
  }

  const attr = `${prefix}-${lightColor}${opacity ? "/" + opacity : ""}`;
  const darkAttr = `${prefix}-${darkColor}${opacity ? "/" + opacity : ""}`;

  return `${attr} dark:${darkAttr}`;
};

export default defineConfig({
  shortcuts: [
    ["flex-center", "flex items-center justify-center"],
    ["hstack", "flex items-center"],
    ["vstack", "hstack flex-col"],
    ["no-outline", "outline-none focus:outline-none"],
    [colorReg("text-c"), (v) => colorAttr("text", v)],
    [colorReg("border-c"), (v) => colorAttr("border", v)],
    [colorReg("bg-c"), (v) => colorAttr("bg", v)],
    ["shadow-menu", "shadow-md shadow-black/25 dark:shadow-black/50"],
    ["window-btn", "size-3 text-black rounded-full flex-center no-outline"],
    ["border-menu", "border-gray-500/50"],
    [
      "menu-box",
      "fixed top-8.5 text-c-black bg-c-200/90 border border-menu rounded-lg shadow-menu"
    ],
    [
      "safari-btn",
      "h-6 outline-none focus:outline-none rounded flex-center border border-c-300"
    ],
    ["cc-btn", "flex-center rounded-full size-8 text-white bg-blue-500"],
    [
      "cc-btn-active",
      "flex-center rounded-full size-8 text-c-700 bg-gray-400/25 dark:bg-gray-300/25"
    ],
    ["cc-text", "text-xs text-c-500"],
    ["cc-grid", "bg-c-200/80 rounded-xl cc-grid-shadow backdrop-blur-2xl"],
    ["battery-level", "absolute rounded-[1px] h-2 top-1/2 -mt-1 ml-0.5 left-0"]
  ],
  rules: [["cc-grid-shadow", { "box-shadow": "0px 1px 5px 0px rgba(0, 0, 0, 0.3)" }]],
  presets: [
    presetUno(),
    presetAttributify(),
    presetIcons({
      warn: true,
      collections: {
        "akar-icons": () => akarIcons,
        "ant-design": () => antDesignIcons,
        bi: () => biIcons,
        bx: () => bxIcons,
        charm: () => charmIcons,
        "fa-brands": () => faBrandsIcons,
        "fa-solid": () => faSolidIcons,
        fe: () => feIcons,
        "game-icons": () => gameIcons,
        gg: () => ggIcons,
        "heroicons-solid": () => heroiconsSolidIcons,
        ic: () => icIcons,
        "icon-park-outline": () => iconParkOutlineIcons,
        ion: () => ionIcons,
        jam: () => jamIcons,
        la: () => laIcons,
        maki: () => makiIcons,
        "material-symbols": () => materialSymbolsIcons,
        mdi: () => mdiIcons,
        octicon: () => octiconIcons,
        ph: () => phIcons,
        ri: () => riIcons,
        "simple-icons": () => simpleIcons,
        tabler: () => tablerIcons
      },
      extraProperties: {
        display: "inline-block"
      }
    })
  ],
  transformers: [
    transformerDirectives(),
    transformerVariantGroup(),
    transformerAttributifyJsx()
  ]
});
