/** @format */

import { Socket } from "socket.io-client";
import type { ShowcaseItem } from "../../../../../shared/obj/ShowcaseTypes";

let $: JQueryStatic;

export class ShowcaseClient {
  /**
   * socket is the socket.io socket connection we'll use for command modification
   */
  public socket: Socket | undefined;

  /**
   * isReady is a promise which may be used to determine whether the class' async setup functions have been completed
   */
  public isReady: Promise<void>;

  /**
   * showcaseContainer is the HTMLElement which contains the art showcase image and other info
   */
  private showcaseContainer: HTMLElement;

  /**
   * showcasePos is showcase position which this client is responsible for monitoring
   */
  private showcasePos: Number;

  /**
   * debug is the property which determines whether debug-level logging is appropriate or not
   */
  private debug: boolean;

  constructor(
    showcaseContainer: HTMLElement,
    showcasePos: Number = 0,
    deubg: boolean = false,
    socket?: Socket
  ) {
    this.showcaseContainer = showcaseContainer;
    this.showcasePos = showcasePos;
    this.isReady = this.init(socket);
    this.debug = deubg;
    this.setupPage();
  }

  // ************************ \\
  // BEGIN - PUBLIC methods
  // ************************ \\
  public getArtShowCase() {
    if (this.debug) {
      console.log(`Requesting art showcase at position ${this.showcasePos}`);
    }
    if (!this.socket) {
      throw "Socket not available, cannot request art showcase";
    }
    this.socket.emit("show-art", this.showcasePos);
  }

  // ************************ \\
  // END - PUBLIC methods
  // ************************ \\

  // ************************ \\
  // BEGIN - PRIVATE methods
  // ************************ \\
  /**
   * Initialize the class, setup all listeners, etc
   *
   * @param socket? - Optional paramater to pass an existing IO instead of creating a new one
   * @returns void
   *
   */
  private async init(socket?: Socket): Promise<void> {
    if (this.debug) {
      console.log(`Initializing ShowcaseClient`);
    }
    $ = (await import("jquery")).default;
    const opts = { forceNew: false, reconnect: true };
    if (socket) {
      this.socket = socket;
    } else {
      const io = (await import("socket.io-client")).default;
      this.socket = io(opts);
    }
    if (this.debug) {
      console.log(`ShowcaseClient initialized`);
    }
  }

  private async setupPage(): Promise<void> {
    // this.setupElementSizes();
    await this.join();
    await this.listenForShowcase();
  }

  /**
   * Configure the size of the image container, image, and 'thanks' message
   *
   *
   */
  //   private setupElementSizes(): void {
  //     const params: URLSearchParams = new URLSearchParams(window.location.search);
  //     const defaults: {container: string, image: string, thanks: string} = {
  //         container: "1920x1080"
  //         ,image: ""
  //         ,thanks: ""
  //     };
  //   }

  /**
   * Join the socket.io room dedicated to showcase
   *
   *
   * @returns void
   *
   */
  private async join(): Promise<void> {
    await this.isReady;
    if (this.debug) {
      console.log(`Joining the showcase socket.io room`);
    }
    if (!this.socket) {
      throw "Socket not available, cannot join showcase room";
    }
    this.socket.emit("join-showcase", this.showcasePos);
    if (this.debug) {
      console.log(`Showcase channel join request sent`);
    }
  }

  /**
   * Sets up listeners for showcase changes
   *
   * @returns void
   */
  private async listenForShowcase(): Promise<void> {
    await this.isReady;
    if (this.debug) {
      console.log(`Setting up showcase listeners`);
    }
    if (!this.socket) {
      throw "Socket not available, cannot listen for showcase";
    }
    this.socket.on(`show-art-${this.showcasePos}`, (showcase: ShowcaseItem) => {
      if (this.debug) {
        console.log(
          `show-art${this.showcasePos} fired! Making changes now.`,
          showcase
        );
      }
      // Change the background-image for the element dedicated to containing the image
      const showcaseURL = `artshow/${showcase.redemption_name}`;
      let showcaseMsg = `Thanks to ${showcase.redeemed_by}!`;
      const imageElem: JQuery<HTMLElement> = $(this.showcaseContainer).find(
        "#img"
      );

      imageElem.attr("src", `${showcaseURL}`);
      imageElem.attr("alt-text", showcase.redemption_name);
      if (showcase.redemption_thanks) {
        showcaseMsg = showcase.redemption_thanks;
      }
      $(this.showcaseContainer).find("#label").text(showcaseMsg);
    });
    if (this.debug) {
      console.log(`Showcase listeners setup`);
    }
  }

  // ************************ \\
  // END - PRIVATE methods
  // ************************ \\
}