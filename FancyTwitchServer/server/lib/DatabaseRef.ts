/** @format */

import { AceBase } from "acebase";

// Configuration connection used to manage local user configuration
console.log("--- config ---");
export const configDB = new AceBase("config", {
  sponsor: process.env.NODE_ENV === "development",
  logLevel: "error",
  info: "",
});

// Commands connection used to manage commands DB
console.log("--- commandDB ---");
export const commandDB = new AceBase("commandDB", {
  sponsor: process.env.NODE_ENV === "development",
  logLevel: "error",
  info: "",
}); // Sponsors can turn off the logo. I did a one-time sponsor of the AceBase project because it's great! However I don't have the $$ to keep a monthly sponsorship going and don't feel good about entirely removing the "advert" for a measly few bucks based on how much work the author puts in. Instead, I'm just going to turn off the banner for development since the banner makes the console difficult to parse. Will have it on in production.

// Variables connection used to manage variable DB
console.log("--- variableDB ---");
export const commandVarsDB = new AceBase("variableDB", {
  sponsor: process.env.NODE_ENV === "development",
  logLevel: "error",
  info: "",
}); // Sponsors can turn off the logo. I did a one-time sponsor of the AceBase project because it's great! However I don't have the $$ to keep a monthly sponsorship going and don't feel good about entirely removing the "advert" for a measly few bucks based on how much work the author puts in. Instead, I'm just going to turn off the banner for development since the banner makes the console difficult to parse. Will have it on in production.

// Showcase connection used to show off art, given an order
console.log("--- showcaseDB ---");
export const showcaseDB = new AceBase("showcaseDB", {
  sponsor: process.env.NODE_ENV === "development",
  logLevel: "error",
  info: "",
}); // Sponsors can turn off the logo. I did a one-time sponsor of the AceBase project because it's great! However I don't have the $$ to keep a monthly sponsorship going and don't feel good about entirely removing the "advert" for a measly few bucks based on how much work the author puts in. Instead, I'm just going to turn off the banner for development since the banner makes the console difficult to parse. Will have it on in production.
