import { Client, Account } from "appwrite";

const client = new Client();

client
  .setEndpoint("https://cloud.appwrite.io/v1")
  .setProject("69ad8e6a002f31946715");

const account = new Account(client);

export { client, account };