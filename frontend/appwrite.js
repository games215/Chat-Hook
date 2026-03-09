import { Client, Account, Client, Account } from "appwrite";

const Client = new Client()
  .setEndpoint('https://cloud.appwrite.io/v1')
  .setPoject('69ad8e6a002f31946715');

const Account = new Account(Client)
 export {Account, Client}