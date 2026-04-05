import { swatch, fileIcon, logoShirt, stylishShirt } from "../assets";

export const EditorTabs = [
  {
    name: "colorpicker",
    icon: swatch,
  },
  {
    name: "filepicker",
    icon: fileIcon,
  },
];

export const FilterTabs = [
  {
    name: "logoShirt",
    icon: logoShirt,
  },
  {
    name: "stylishShirt",
    icon: stylishShirt,
  },
];

export const DecalTypes = {
  front: {
    stateProperty: "frontDecal",
    filterTab: "logoShirt",
  },
  back: {
    stateProperty: "backDecal",
    filterTab: "logoShirt",
  },
  leftShoulder: {
    stateProperty: "leftShoulderDecal",
    filterTab: "logoShirt",
  },
  rightShoulder: {
    stateProperty: "rightShoulderDecal",
    filterTab: "logoShirt",
  },
  full: {
    stateProperty: "fullDecal",
    filterTab: "stylishShirt",
  },
};

export const DesignSides = [
  { value: "front", label: "Front" },
  { value: "back", label: "Back" },
  { value: "leftShoulder", label: "Left Shoulder" },
  { value: "rightShoulder", label: "Right Shoulder" },
];
