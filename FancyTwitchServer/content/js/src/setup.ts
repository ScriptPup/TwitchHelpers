/** @format */
import type { Converter } from "showdown";
import {
  FancyCommand,
  FancyRedemption,
  getUserType,
} from "../../../shared/obj/FancyCommandTypes";
import { UserTypes } from "../../../shared/obj/FancyCommandTypes";
import { BotAccount } from "../../../shared/obj/TwitchObjects";
import { FancyCommandClient } from "./lib/FancyCommandClient";
import { FancyRedemptionClient } from "./lib/FancyRedemptionClient";

let converter: Converter;
let command_template: string | null = null;
let redemption_template: string | null = null;
let bot_form_template: string | null = null;
let $: JQueryStatic;

let FCC: FancyCommandClient;
let FRC: FancyRedemptionClient;

/**
 * Simple function to resize textarea to fit contents better. Why this isn't builtin to the HTML spec, no idea
 * https://stackoverflow.com/questions/995168/textarea-to-resize-based-on-content-length
 *
 *
 * @param element - the TextArea element to resize
 * @returns void
 *
 */
function textAreaAdjust(element: HTMLElement) {
  element.style.height = "1px";
  element.style.height = 25 + element.scrollHeight + "px";
}

/**
 * Sets the information-contents panel to display the HTML provided
 *
 *
 * @param html - The HTML to display in the information-contents panel
 * @returns void
 *
 */
const setInformationContents = async (
  inf: string | null = "basic"
): Promise<void> => {
  if (!converter) {
    converter = new (await import("showdown")).Converter();
  }
  const html = converter.makeHtml(await getInformationContents(inf));
  const info: HTMLElement | null = document.getElementById(
    "information-contents"
  );
  $("#information-options")
    .find("li")
    .each((ix, li) => {
      const li_inf = $(li).attr("inf");
      if (inf === li_inf) {
        $(li).addClass("selected");
      } else {
        $(li).removeClass("selected");
      }
    });
  if (null === info) {
    throw new Error("Information-contents not found, unable to load data in");
  }
  info.innerHTML = html;
};

/**
 * Add a new command to the page command list, given the FancyCommand pieces
 *
 * @remarks
 * Technically the ClientFancyCommand type pieces are what we're looking for
 *
 * @param name - The name of the command
 * @param command - The command which which will be run when the command is called
 * @param usableBy - Who is able to call the command
 * @returns void
 */
const addCommand = async (
  name: string,
  command: string,
  usableBy: string,
  expand: boolean = false
) => {
  if (null === command_template) {
    await getTemplateContents();
  }

  let contents: string | null = command_template;
  if (null === contents) {
    throw new Error("No content template found, unable to display information");
  }
  contents = contents
    .replaceAll("{name}", name)
    .replaceAll("{command}", command)
    .replaceAll("{usableBy}", usableBy);

  let domContent: JQuery.Node[] = $.parseHTML(contents);
  $(domContent)
    .find(`.select-usableby option[value="${usableBy}"]`)
    .prop("selected", true);
  $(domContent).attr("id", name);
  $(domContent)
    .find("textarea")
    .on("keyup", (evnt) => {
      textAreaAdjust(evnt.target);
    });

  $(domContent)
    .find("summary")
    .on("click", (evnt) => {
      const elem: HTMLElement = evnt.delegateTarget.parentNode as HTMLElement;
      if (elem.hasAttribute("open")) {
        return;
      }
      $(domContent)
        .find("textarea")
        .each((ix, elem) => {
          setTimeout(() => textAreaAdjust(elem), 1);
        });
    });
  setupCommandButtons($(domContent));
  $("#command-list").append(domContent);
  if (expand) {
    $(domContent).attr("open", "true");
  }
};

/**
 * Add a new command to the page command list, given the FancyCommand pieces
 *
 * @remarks
 * Technically the ClientFancyCommand type pieces are what we're looking for
 *
 * @param name - The name of the command
 * @param command - The command which which will be run when the command is called
 * @param usableBy - Who is able to call the command
 * @returns void
 */
const addRedemption = async (
  redemption: FancyRedemption,
  expand: boolean = false
) => {
  if (null === redemption_template) {
    await getTemplateContents();
  }

  let contents: string | null = redemption_template;
  if (null === contents) {
    throw new Error("No content template found, unable to display information");
  }

  contents = contents
    .replaceAll("{name}", redemption.name)
    .replaceAll("{prompt}", redemption.prompt)
    .replaceAll("{command}", redemption.command)
    .replaceAll("{cost}", redemption.cost.toString())
    .replaceAll(
      "{max_per_stream}",
      redemption.max_per_stream?.toString() || "0"
    )
    .replaceAll(
      "{max_per_user_per_stream}",
      redemption.max_per_user_per_stream?.toString() || "0"
    )
    .replaceAll(
      "{global_cooldown}",
      redemption.global_cooldown?.toString() || "0"
    );

  let domContent: JQuery.Node[] = $.parseHTML(contents);

  // Set the currently selected options for dropdowns
  $(domContent)
    .find(`#select-userinput option[value="${redemption.user_input}"]`)
    .prop("selected", true);
  $(domContent)
    .find(`#select-enabled option[value="${redemption.enabled}"]`)
    .prop("selected", true);
  $(domContent)
    .find(`#select-linked option[value="${redemption.linked}"]`)
    .prop("selected", true);

  $(domContent).attr("id", redemption.name.replace(" ", "_"));
  $(domContent)
    .find("textarea")
    .on("keyup", (evnt) => {
      textAreaAdjust(evnt.target);
    });

  // When the details element is opened, resize the textareas to show the entire command
  $(domContent)
    .find("summary")
    .on("click", (evnt) => {
      const elem: HTMLElement = evnt.delegateTarget.parentNode as HTMLElement;
      if (elem.hasAttribute("open")) {
        return;
      }
      $(domContent)
        .find("textarea")
        .each((ix, elem) => {
          setTimeout(() => textAreaAdjust(elem), 1);
        });
    });

  setupRedeemButtons($(domContent));
  $("#command-list").append(domContent);
  if (expand) {
    $(domContent).attr("open", "true");
  }
};

/**
 * Add listeners to the child buttons (save, delete) for commands
 *
 *
 * @param element - the parent command element which we want to subscribe actions to
 * @returns void
 *
 */
const setupCommandButtons = (element: JQuery<JQuery.Node[]>): void => {
  element.find("#save-command").on("click", () => {
    const name: string =
      element.find(".command-name").val()?.toString() || "!unknown";
    const command: string =
      element.find(".command-execute").val()?.toString() || "";
    const usableBy: UserTypes =
      getUserType(
        element.find(".select-usableby option:selected").val()?.toString() ||
          "6"
      ) || UserTypes.EVERYONE;
    if (!FCC) {
      throw new Error(
        "Fancy command client not initialized, unable to setup buttons!"
      );
    }
    const ncmd: FancyCommand = { name, command, usableBy };
    FCC.addCommand({ name, command, usableBy });
    element.remove();
  });
  element.find(".remove-item").on("click", () => {
    const name: string =
      element.find(".command-name").val()?.toString() || "!unknown";
    FCC.removeCommand(name);
  });
};

/**
 * Add listeners to the child buttons (save, delete) for redemptions
 *
 *
 * @param element - the parent command element which we want to subscribe actions to
 * @returns void
 *
 */
const setupRedeemButtons = (element: JQuery<JQuery.Node[]>): void => {
  element.find("#save-redemption").on("click", () => {
    const name: string =
      element.find(".command-name").val()?.toString() || "!unknown";
    const prompt: string =
      element.find(".command-prompt").val()?.toString() || "";
    const command: string =
      element.find(".command-execute").val()?.toString() || "";
    const cost: number = Number.parseInt(
      element.find(".command-cost").val()?.toString() || "1"
    );
    const max_per_stream: number = Number.parseInt(
      element.find(".command-max_per_stream").val()?.toString() || "0"
    );
    const max_per_user_per_stream: number = Number.parseInt(
      element.find(".command-max_per_user_per_stream").val()?.toString() || "0"
    );
    const global_cooldown: number = Number.parseInt(
      element.find(".command-global_cooldown").val()?.toString() || "0"
    );
    const user_input: boolean =
      element.find("#select-userinput option:selected").val()?.toString() ===
      "true";
    const enabled: boolean =
      element.find("#select-enabled option:selected").val()?.toString() ===
      "true";
    const linked: boolean =
      element.find("#select-linked option:selected").val()?.toString() ===
      "true";

    const redemptionItem: FancyRedemption = {
      name,
      command,
      prompt,
      cost,
      max_per_stream,
      max_per_user_per_stream,
      global_cooldown,
      user_input,
      linked,
      enabled,
    };

    if (!FRC) {
      throw new Error(
        "Fancy command client not initialized, unable to setup buttons!"
      );
    }
    FRC.addCommand(redemptionItem);
    element.remove();
  });
  element.find(".remove-item").on("click", () => {
    const name: string =
      element.find(".command-name").val()?.toString() || "!unknown";
    FRC.removeCommand(name);
  });
};

/**
 * Removes the command DOM element from the list
 *
 *
 * @param name - name of the command to remove
 * @returns void
 *
 */
const removeCommand = (name: string): void => {
  const cmdElem: HTMLElement | null = document.getElementById(name);
  if (!cmdElem) {
    throw new Error(`Cannot find #${name} to remove it from the DOM`);
  }
  $(cmdElem).remove();
};

/**
 * Creates clients for FancyCommands and FancyRedemptions
 * Once they've been created, will call setup functions to prep them for listening
 *
 */
const connectServer = (): void => {
  FCC = new FancyCommandClient();
  FRC = new FancyRedemptionClient();

  setupFCC();
  setupFRC();
  authorizedApplication();
};

/**
 * Sets up the FancyCommandClient to listen for changes, and initialize the global object to allow interfacing with the server
 *
 */
const setupFRC = (): void => {
  FRC.onAdd((cmd: FancyRedemption) => {
    addRedemption(cmd);
  });
  FRC.onRemove(({ name }) => {
    removeCommand(name);
  });
};

/**
 * Sets up the FancyCommandClient to listen for changes, and initialize the global object to allow interfacing with the server
 *
 */
const setupFCC = (): void => {
  FCC.onAdd((cmd: FancyCommand) => {
    const [name, command, usableBy] = [
      cmd.name,
      cmd.command,
      UserTypes[cmd.usableBy],
    ];
    addCommand(name, command, usableBy.toLowerCase());
  });
  FCC.onRemove(({ name }) => {
    removeCommand(name);
  });
};

/**
 * Retrieve the information for the information-panel from the .md file
 *
 *
 * @returns a promise with the markdown contents
 *
 */
const getInformationContents = async (
  info?: string | null
): Promise<string> => {
  const infoParam = info
    ? info
    : new URLSearchParams(window.location.search).get("info") || "basic";
  return fetch(`/markdown/${infoParam}.md`, {
    headers: {
      "Content-Type": "text/plain",
    },
  })
    .then((res: Response) => {
      return res.text().then((txt: string) => {
        if (txt.startsWith("Error")) {
          return getNotFoundMDMessage();
        }
        return txt;
      });
    })
    .catch(() => {
      return getNotFoundMDMessage();
    });
};

const getNotFoundMDMessage = async (): Promise<string> => {
  return fetch(`/markdown/not_found.md`, {
    headers: {
      "Content-Type": "text/plain",
    },
  }).then((res: Response) => {
    return res.text().then((txt: string) => {
      return txt;
    });
  });
};

/**
 * Retrieve the html templates which will be used as the new command HTML structure
 *
 * @remarks
 * this function sets the command_template global
 *
 * @returns void
 *
 */
const getTemplateContents = async () => {
  const cmdItm: Promise<void | Response> = fetch(
    "/html_templates/command-item.html",
    {
      headers: {
        "Content-Type": "text/plain",
      },
    }
  ).then((res) => {
    return res.text().then((txt) => {
      command_template = txt;
      return;
    });
  });
  const redeemItm: Promise<void | Response> = fetch(
    "/html_templates/redemption-item.html",
    {
      headers: {
        "Content-Type": "text/plain",
      },
    }
  ).then((res) => {
    return res.text().then((txt) => {
      redemption_template = txt;
      return;
    });
  });
  return Promise.all([cmdItm, redeemItm]);
};

/**
 * Retrieve the html template which will be used for bot settings
 *
 *
 */
const getBotTemplateContents = async () => {
  return fetch("/html_templates/bot-settings-modal.html", {
    headers: {
      "Content-Type": "text/plain",
    },
  }).then((res) => {
    return res.text().then((txt) => {
      bot_form_template = txt;
    });
  });
};

/**
 * Saves the data from the bot form to the server
 *
 *
 */
const saveBotData = async (data: BotAccount) => {
  if (!FCC.socket) {
    throw new Error("Socket not connected, cannot send data to server");
  }
  if (
    data["username"] === "" &&
    data["client_id"] === "" &&
    data["client_secret"] === ""
  ) {
    FCC.socket.emit("update-bot-acct", null);
    return;
  }
  FCC.socket.emit("update-bot-acct", data);
};

/**
 * Displays the bot template modal
 *
 */
const showBotTemplate = async () => {
  if (null === bot_form_template) {
    await getBotTemplateContents();
  }
  // The if is unecissary because of the above, but typescript insists on wasting cycles
  if (bot_form_template) {
    const newModalHTML = $.parseHTML(bot_form_template);
    const newModal = $(newModalHTML);
    $("body").append(newModalHTML);
    newModal.find("#modal-submit").on("click", (e: Event) => {
      e.preventDefault();
      const formserializeArray = newModal.find("form").serializeArray();
      const jsonObj: { [key: string]: string } = {};
      $.map(formserializeArray, function (n, i) {
        jsonObj[n.name] = n.value;
      });
      const botAccount: BotAccount = {
        channel: jsonObj["channel"],
        client_id: jsonObj["client_id"],
        client_secret: jsonObj["client_secret"],
        username: jsonObj["username"],
        // auth_code?: string
      };
      const state = Math.random().toString(16).substr(2, 8);
      localStorage.setItem("auth-verify-code", state);
      localStorage.setItem("auth-verify-cache", JSON.stringify(botAccount));

      const scopes = [
        "channel:read:redemptions",
        "chat:read",
        "chat:edit",
        "channel:moderate",
        "whispers:read",
        "whispers:edit",
      ].join("+");

      const twitchAuthURI = new URL(`https://id.twitch.tv/oauth2/authorize`);
      twitchAuthURI.searchParams.append("response_type", "code");
      twitchAuthURI.searchParams.append("client_id", botAccount.client_id);
      twitchAuthURI.searchParams.append(
        "redirect_uri",
        "http://localhost:9000/setup"
      );
      // twitchAuthURI.searchParams.append("scope", scopes);
      twitchAuthURI.searchParams.append("token_type", "bearer");
      twitchAuthURI.searchParams.append("state", state);

      $(window).attr("location", twitchAuthURI.toString() + "&scope=" + scopes);
    });
    newModal.find("#modal-cancel").on("click", () => {
      newModal.remove();
    });
    if (!FCC.socket) {
      throw new Error("Socket not connected, cannot send data to server");
    }
    FCC.socket.once("get-bot-acct", (res) => {
      if (null === res) {
        newModal.find("input").val("");
        return;
      }
      const { channel, client_id, username }: BotAccount = res;
      newModal.find("input[name='channel']").val(channel);
      newModal.find("input[name='username']").val(username);
      newModal.find("input[name='client_id']").val(client_id);
      newModal.find("input[name='client_secret']").val("*****");
    });
    FCC.socket.emit("get-bot-acct", true);
  }
};

const authorizedApplication = async () => {
  if (FCC.isReady) {
    await FCC.isReady;
  } else {
    setTimeout(authorizedApplication, 200);
    return;
  }
  if (!window.location.search) {
    return;
  }
  const parsedURLParams = new URLSearchParams(window.location.search);
  const botCode = parsedURLParams.get("code");
  if (!botCode) {
    return;
  }
  const state = localStorage.getItem("auth-verify-code");
  const rawBotData = localStorage.getItem("auth-verify-cache");
  if (!rawBotData) {
    console.error(
      "Bot data not stored locally, cannot retrieve to send data to server."
    );
    return;
  }
  const botAccount = JSON.parse(rawBotData);

  try {
    const stateVerify = parsedURLParams.get("state");
    if (state !== stateVerify) {
      throw new Error(
        "State returned isn't the same as state sent, something malicious is likely going on. Verify your network connection is private and trusted!"
      );
    }

    // If we've verified everything satisfactorially, then send the botAccount data to the server
    botAccount["auth_code"] = botCode;
    if (!botAccount.auth_code) {
      throw new Error("Somehow the authorization code doesn't exist!");
    }

    saveBotData(botAccount);
  } finally {
    // Remove query string from navigation, we don't want the user to refresh the page and end up invalidating their token
    window.history.replaceState(
      null,
      document.title,
      window.location.toString().split("?")[0]
    );

    // Clear the temporary data storage used
    localStorage.removeItem("auth-verify-code");
    localStorage.removeItem("auth-verify-cache");
  }
};

/**
 * Setup the page to work as designed! It's gonna do some things and some stuff, awesome!
 *   just, like, look at the other functions for more information... I can't be bothered to explain everything here
 *
 *
 * @returns void
 *
 */
const setupPage = async () => {
  $ = (await import("jquery")).default;
  setInformationContents();

  // Setup actions to do when the server says we got new commands, or existing ones have been removed.
  connectServer();

  // Setup button click actions
  setupButtonListeners();
};

/**
 * Sets up the listeners for buttons
 *
 */
const setupButtonListeners = async () => {
  $("#btn-new-cmd").on("click", () => {
    addCommand("!", "", "everyone", true);
  });
  $("#btn-new-redeem").on("click", () => {
    addRedemption({ name: "", prompt: "", cost: 1, command: "" }, true);
  });
  $("#btn-bot-settings").on("click", () => {
    showBotTemplate();
  });
  $("#information-options")
    .find("li")
    .on("click", (evnt) => {
      const infPg = $(evnt.delegateTarget).attr("inf");
      if (infPg) {
        const url = new URL(window.location.href);
        url.searchParams.set("info", infPg);
        window.history.pushState({}, "", url);
        setInformationContents(infPg);
      }
    });
};

/**
 *
 * When the document is loaded, setup the page
 *
 */
document.addEventListener("DOMContentLoaded", function () {
  setupPage();
});
