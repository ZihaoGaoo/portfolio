import React from "react";

interface MenuItemProps {
  onClick?: (e: React.MouseEvent<HTMLLIElement>) => void;
  children: React.ReactNode;
}

interface MenuItemGroupProps {
  border?: boolean;
  children: React.ReactNode;
}

const MenuItem = (props: MenuItemProps) => {
  return (
    <li
      onClick={props.onClick}
      className="text-sm leading-6 whitespace-nowrap cursor-default px-2.5 rounded hover:text-white hover:bg-blue-500"
    >
      {props.children}
    </li>
  );
};

const MenuItemGroup = (props: MenuItemGroupProps) => {
  const borderClass = props.border === false ? "pb-1" : "menu-item-group-divider";

  return <ul className={`menu-item-group ${borderClass}`}>{props.children}</ul>;
};

export { MenuItem, MenuItemGroup };
