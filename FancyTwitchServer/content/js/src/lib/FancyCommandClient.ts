/** @format */

import type { Socket } from "socket.io-client";
import type {
  FancyCommand,
  ClientFancyCommand,
} from "../../../../shared/obj/FancyCommandTypes";
import { UserTypes } from "../../../../shared/obj/FancyCommandTypes";

/**
 * Simple typing to explain the expected structure of a next() function
 *
 */
export type Next = () => void;

/**
 * Simple typing to explain the expected structure of a FancyCommandClient use function or lambda
 *
 */
export type FancyCommandClientMiddleware<T> = (context: T, next: Next) => void;

export class FancyCommandClient {
  /**
   * _onAdd is the list of commands to run when a command-add event is recieved from the server
   */
  private _onAdd: FancyCommandClientMiddleware<FancyCommand>[] = new Array<
    FancyCommandClientMiddleware<FancyCommand>
  >();
  /**
   * _onRemove is the list of commands to run when a command-remove event is recieved from the server
   */
  private _onRemove: FancyCommandClientMiddleware<{ name: string }>[] =
    new Array<FancyCommandClientMiddleware<{ name: string }>>();

  /**
   * socket is the socket.io socket connection we'll use for command modification
   */
  public socket: Socket | undefined;

  /**
   * isReady is a promise which can be used to wait for the FCC sockets to be connected and ready for use when uncertain
   */
  public isReady?: Promise<void>;

  private commands: ClientFancyCommand[] = new Array<ClientFancyCommand>();

  /**
   * The FancyCommandClient class provides an easy way to reactively make changes based on adding/removing commands
   *
   *
   *
   * @param socket - Optional socket, if not provided then a new socket connection will be created on class creation
   * @returns returned value explanation
   *
   */
  constructor(socket?: Socket) {
    this.init(socket);
  }

  private async init(socket?: Socket) {
    const io = (await import("socket.io-client")).default;
    const opts = { forceNew: false, reconnect: true };
    if (socket) {
      this.socket = socket;
    } else {
      this.socket = io(opts);
    }
    this.addNewCommandsToLocalCache();
    this.removeNewCommandsFromLocalCache();
    this.setupServerListeners();
    if (socket) {
      this.isReady = new Promise((resolve) => resolve());
      return;
    }
    this.isReady = this.whenSocketConnects();
  }

  private async whenSocketConnects(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (this.socket) {
        this.socket.on("connect", () => {
          resolve();
        });
      }
    });
  }

  /**
   * provides a simple interface for reacting to added command events sent from the server
   *
   * @remarks
   * Essentially a wrapper for io.on('command-add',()=>{}), intended to keep the codebase cleaner
   *
   * @param middleware - The function to run when a new command is recieved from the server
   * @returns void
   *
   */
  public onAdd(
    ...middleware: FancyCommandClientMiddleware<FancyCommand>[]
  ): void {
    this._onAdd.push(...middleware);
  }

  /**
   * provides a simple interface for reacting to removed command events sent from the server
   *
   * @remarks
   * Essentially a wrapper for the io.on('command-remove',()=>{}), intended to keep the coadbase cleaner
   *
   * @param middleware - The function to run when a command is removed from the server
   * @returns void
   *
   */
  public onRemove(
    ...middleware: FancyCommandClientMiddleware<{ name: string }>[]
  ): void {
    this._onRemove.push(...middleware);
  }

  /**
   * Provide simple interface for adding a command to the server
   *
   * @remarks
   * additional details
   *
   * @param cmd - Expects ClientFancyCommand object {name: string, command: string, usableBy: string}
   * @returns void
   *
   */
  public addCommand(cmd: ClientFancyCommand): void {
    if (!this.socket) {
      throw new Error(
        "FrancyCommandClient.socket is not defined, cannot add command"
      );
    }
    this.socket.emit("command-add", cmd);
  }
  /**
   * Provide simple interface for removing a command from the server
   *
   * @remarks
   * additional details
   *
   * @param name - The name of the command to remove
   * @returns void
   *
   */
  public removeCommand(name: string): void {
    if (!this.socket) {
      throw new Error(
        "FrancyCommandClient.socket is not defined, cannot remove command"
      );
    }
    this.socket.emit("command-remove", { name });
  }

  /**
   * Provide a simple interface for renaming a command on the server
   *
   * @remarks
   * This is essentially a wrapper for removeCommand + addCommand
   * Will fail with an error if the new name already exists
   *
   * @param origName - Original name of the command
   * @param newCmd - New command object
   * @returns void
   *
   */
  public renameCommand(origName: string, newCmd: ClientFancyCommand): void {
    if (this.commands.find((x) => x.name === newCmd.name)) {
      throw new Error(
        `Sorry, can't rename ${origName} as ${newCmd.name}, because ${newCmd.name} is already defined`
      );
    }
    this.removeCommand(origName);
    this.addCommand(newCmd);
  }

  /**
   * Default middleware which is run anytime the command-add event occurs
   *
   * @remarks
   * Will add the new command to the this.commands internal cache
   *
   * @returns void
   *
   */
  private addNewCommandsToLocalCache(): void {
    this.onAdd((cmd: FancyCommand) => {
      const existingCmd = this.commands.findIndex((x) => {
        x.name === cmd.name;
      });
      const clientFC: ClientFancyCommand = {
        name: cmd.name,
        command: cmd.command,
        usableBy: UserTypes[cmd.usableBy],
      };
      if (existingCmd) {
        this.commands[existingCmd] = clientFC;
        return;
      }
      this.commands.push(clientFC);
    });
  }

  /**
   * Default middleware which is run anytime the command-remove event occurs
   *
   * @remarks
   * Will remove the named command from the this.commands internal cache
   *
   * @returns void
   *
   */
  private removeNewCommandsFromLocalCache(): void {
    this.onRemove(({ name }) => {
      this.commands.splice(
        this.commands.findIndex((x) => {
          x.name === name;
        }),
        1
      );
    });
  }
  /**
   * Executes all the functions provided in onAdd when the server event is recieved
   *
   *
   * @returns void
   *
   */
  private doAdd(
    context: FancyCommand,
    middlewares: FancyCommandClientMiddleware<FancyCommand>[]
  ): void {
    if (!middlewares.length) {
      return;
    }
    const mw: FancyCommandClientMiddleware<FancyCommand> = middlewares[0];
    return mw(context, () => {
      this.doAdd(context, middlewares.slice(1));
    });
  }

  /**
   * Request all commands from the server in one list and then do something with the results
   *
   * @remarks
   * If no callback is supplied, then doAdd() is called for each command, effectively acting like command-add has been fired once per command
   *
   * @param callback - Optional callback, provided to do something with resulting list
   * @returns void
   *
   */
  public cacheCommands(callback?: (cmdList: FancyCommand[]) => {}): void {
    if (!this.socket) {
      throw new Error(
        "FrancyCommandClient.socket is not defined, cannot cache commands"
      );
    }
    this.socket.once("command-list", (cmdList: FancyCommand[]) => {
      if (callback) {
        callback(cmdList);
      } else {
        cmdList.forEach((cmd) => {
          this.doAdd(cmd, this._onAdd);
        });
      }
    });
    this.socket.emit("command-list");
  }

  /**
   * Executes all the functions provided in onRemove when the server event is recieved
   *
   *
   * @returns void
   *
   */
  private doRemove(
    context: { name: string },
    middlewares: FancyCommandClientMiddleware<{ name: string }>[]
  ): void {
    if (!middlewares.length) {
      return;
    }
    const mw = middlewares[0];
    return mw(context, () => {
      this.doRemove(context, middlewares.slice(1));
    });
  }

  /**
   * Join the setup-commands room, and listen for server events once joined
   *
   * @returns void
   *
   */
  private setupServerListeners(): void {
    if (!this.socket) {
      throw new Error(
        "FrancyCommandClient.socket is not defined, cannot setup listeners"
      );
    }
    const socket = this.socket; // Had to do this because typescript can be incredibly stupid
    socket.once("joined-setup-commands", () => {
      socket.on("command-add", (cmd: FancyCommand) => {
        console.log("Firing onAdd with cmd", cmd);
        this.doAdd(cmd, this._onAdd);
      });

      socket.on("command-remove", (rmv: { name: string }) => {
        this.doRemove(rmv, this._onRemove);
      });
      // Get existing commands from server
      this.cacheCommands();
    });
    socket.emit("join-setup-commands", true);
  }
}
