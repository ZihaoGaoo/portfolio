import React, { useEffect, useRef, useState, type JSX } from "react";
import { format } from "date-fns";
import { apps, launchpadApps } from "~/configs";
import { useClickOutside } from "~/hooks";
import type { LaunchpadData, AppsData } from "~/types";

const APPS: { [key: string]: (LaunchpadData | AppsData)[] } = {
  app: apps,
  portfolio: launchpadApps
};

const getRandom = (min: number, max: number) => {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const getRandomDate = () => {
  const timeStamp = new Date().getTime();
  const randomStamp = getRandom(0, timeStamp);
  const date = format(randomStamp, "MM/dd/yyyy");
  return date;
};

interface SpotlightProps {
  toggleSpotlight: () => void;
  openApp: (id: string) => void;
  toggleLaunchpad: (target: boolean) => void;
  btnRef: React.RefObject<HTMLDivElement | null> | null;
}

export default function Spotlight({
  toggleSpotlight,
  openApp,
  toggleLaunchpad,
  btnRef
}: SpotlightProps) {
  const spotlightRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [clickedID, setClickedID] = useState("");
  const [doubleClicked, setDoubleClicked] = useState<boolean>(false);

  const [searchText, setSearchText] = useState("");
  const [curDetails, setCurDetails] = useState<any>(null);

  const [appIdList, setAppIdList] = useState<string[]>([]);
  const [appList, setAppList] = useState<JSX.Element | null>(null);

  const textWhite = "text-white";
  const textBlack = "text-c-black";
  const textSelected = "bg-blue-500";

  useClickOutside(spotlightRef, toggleSpotlight, btnRef ? [btnRef] : []);

  useEffect(() => {
    updateAppList();
  }, [searchText]);

  useEffect(() => {
    updateCurrentDetails();
  }, [selectedIndex]);

  useEffect(() => {
    if (appIdList.length === 0) return;
    // find app's index given its id
    const newSelectedIndex = appIdList.findIndex((item) => {
      return item === clickedID;
    });
    // update index
    updateHighlight(selectedIndex, newSelectedIndex);
    setSelectedIndex(newSelectedIndex);
  }, [clickedID]);

  useEffect(() => {
    if (doubleClicked) {
      launchSelectedApp();
      setDoubleClicked(false);
    }
  }, [doubleClicked]);

  const search = (type: string) => {
    if (searchText === "") return [];

    const text = searchText.toLowerCase();
    return APPS[type].filter(
      (item: LaunchpadData | AppsData) =>
        item.title.toLowerCase().includes(text) || item.id.toLowerCase().includes(text)
    );
  };

  const handleClick = (id: string) => {
    setClickedID(id);
  };

  const handleDoubleClick = (id: string) => {
    setClickedID(id);
    setDoubleClicked(true);
  };

  const launchSelectedApp = () => {
    if (curDetails.type === "app" && !curDetails.link) {
      const id = curDetails.id;
      if (id === "launchpad") toggleLaunchpad(true);
      else openApp(id);
      toggleSpotlight();
    } else {
      window.open(curDetails.link);
      toggleSpotlight();
    }
  };

  const getTypeAppList = (type: string, startIndex: number) => {
    const result = search(type);
    const typeAppList = [];
    const typeAppIdList = [];

    for (const app of result) {
      const curIndex = startIndex + typeAppList.length;
      const bg = curIndex === 0 ? textSelected : "bg-transparent";
      const text = curIndex === 0 ? textWhite : textBlack;

      if (curIndex === 0) setCurrentDetailsWithType(app, type);

      typeAppList.push(
        <li
          id={`spotlight-${app.id}`}
          key={`spotlight-${app.id}`}
          className={`pr-1 h-7 w-full flex rounded ${bg} ${text} cursor-default`}
          data-app-type={type}
          onClick={() => handleClick(app.id)}
          onDoubleClick={() => handleDoubleClick(app.id)}
        >
          <div className="w-8 flex-center">
            <img w-5 src={app.img} alt={app.title} title={app.title} />
          </div>
          <div className="flex-1 hstack overflow-hidden whitespace-nowrap">
            {app.title}
          </div>
        </li>
      );
      typeAppIdList.push(app.id);
    }

    return {
      appList: typeAppList,
      appIdList: typeAppIdList
    };
  };

  const updateAppList = () => {
    const app = getTypeAppList("app", 0);
    const portfolio = getTypeAppList("portfolio", app.appIdList.length);

    const newAppIdList = [...app.appIdList, ...portfolio.appIdList];
    // don't show app details when there is no associating app
    if (newAppIdList.length === 0) setCurDetails(null);

    const newAppList = (
      <div>
        {app.appList.length !== 0 && (
          <div>
            <div className="spotlight-type">Applications</div>
            <ul className="w-full text-xs">{app.appList}</ul>
          </div>
        )}
        {portfolio.appList.length !== 0 && (
          <div>
            <div className="spotlight-type mt-1.5 before:(content-empty absolute left-0 top-0 ml-2 w-63.5 border-t border-menu)">
              Portfolio
            </div>
            <ul className="w-full text-xs">{portfolio.appList}</ul>
          </div>
        )}
      </div>
    );

    setAppIdList(newAppIdList);
    setAppList(newAppList);
  };

  const setCurrentDetailsWithType = (app: any, type: string) =>
    setCurDetails({
      ...app,
      type
    });

  const updateCurrentDetails = () => {
    if (appIdList.length === 0 || searchText === "") {
      setCurDetails(null);
      return;
    }

    const appId = appIdList[selectedIndex];
    const element = document.querySelector(`#spotlight-${appId}`) as HTMLElement;
    const type = element.dataset.appType as string;
    const app = APPS[type].find((item: LaunchpadData | AppsData) => item.id === appId);

    setCurrentDetailsWithType(app, type);
  };

  const updateHighlight = (prevIndex: number, curIndex: number) => {
    if (appIdList.length === 0) return;

    // remove highlight
    const prevAppId = appIdList[prevIndex];
    const prev = document.querySelector(`#spotlight-${prevAppId}`) as HTMLElement;
    prev.className = prev.className
      .replace(textWhite, textBlack)
      .replace(textSelected, "bg-transparent");

    // add highlight
    const curAppId = appIdList[curIndex];
    const cur = document.querySelector(`#spotlight-${curAppId}`) as HTMLElement;
    cur.className = cur.className
      .replace(textBlack, textWhite)
      .replace("bg-transparent", textSelected);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const keyCode = e.key;
    const numApps = appIdList.length;

    // ----------- select next app -----------
    if (keyCode === "ArrowDown" && selectedIndex < numApps - 1) {
      updateHighlight(selectedIndex, selectedIndex + 1);
      setSelectedIndex(selectedIndex + 1);
    }
    // ----------- select previous app -----------
    else if (keyCode === "ArrowUp" && selectedIndex > 0) {
      updateHighlight(selectedIndex, selectedIndex - 1);
      setSelectedIndex(selectedIndex - 1);
    }
    // ----------- launch app -----------
    else if (keyCode === "Enter") {
      if (!curDetails) return;
      launchSelectedApp();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // update highlighted line
    updateHighlight(selectedIndex, 0);
    // current selected id go back to 0
    setSelectedIndex(0);
    // update search text and associating app list
    setSearchText(e.target.value);
  };

  return (
    <div
      className="spotlight"
      onKeyDown={handleKeyPress}
      onClick={() => inputRef.current?.focus()}
      ref={spotlightRef}
    >
      <div
        className="spotlight-search grid h-16 w-full grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-2 px-3 sm:h-18 sm:px-4"
      >
        <div className="flex-center">
          <span className="i-bx:search text-c-600 text-[30px] sm:text-[34px]" />
        </div>
        <input
          ref={inputRef}
          className="spotlight-input h-full min-w-0 w-full border-none bg-transparent px-1 text-[2rem] leading-none text-c-black outline-none sm:text-[2.5rem]"
          placeholder="Spotlight Search"
          value={searchText}
          onChange={handleInputChange}
          autoFocus={true}
        />
        {curDetails && (
          <div className="hidden sm:flex flex-center">
            <img
              className="size-9 rounded-xl object-cover"
              src={curDetails.img}
              alt={curDetails.title}
              title={curDetails.title}
            />
          </div>
        )}
      </div>
      {searchText !== "" && (
        <div className="spotlight-results flex h-85 border-t border-menu bg-black/2">
          <div className="spotlight-list w-36 overflow-y-auto px-2.5 py-2 sm:w-72" border="r menu">
            {appList}
          </div>
          {curDetails && (
            <div className="flex-1 vstack">
              <div className="mx-auto flex h-56 w-4/5 flex-col items-center justify-center border-b border-menu px-6 text-center">
                <img
                  className="size-28 rounded-[28px] object-cover shadow-lg shadow-black/12"
                  src={curDetails.img}
                  alt={curDetails.title}
                  title={curDetails.title}
                />
                <div className="mt-4 text-xl font-medium text-c-black">
                  {curDetails.title}
                </div>
                <div className="mt-1 text-xs text-c-500">
                  {`Version: ${getRandom(0, 99)}.${getRandom(0, 999)}`}
                </div>
              </div>
              <div className="flex flex-1 items-center px-6 text-xs">
                <div className="w-1/2 space-y-2 text-right text-c-500">
                  <div>Kind</div>
                  <div>Size</div>
                  <div>Created</div>
                  <div>Modified</div>
                  <div>Last opened</div>
                </div>
                <div className="flex-1 space-y-2 pl-3 text-c-black">
                  <div>{curDetails.type === "app" ? "Application" : "Portfolio"}</div>
                  <div>{`${getRandom(0, 999)} G`}</div>
                  <div>{getRandomDate()}</div>
                  <div>{getRandomDate()}</div>
                  <div>{getRandomDate()}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
