import * as dotenv from "dotenv";
dotenv.config();

import { updateIpListItems, createList, getAllLists } from "./utils";

import Ajv from "ajv";
import addFormats from "ajv-formats";

const ajv = new Ajv();

addFormats(ajv);

const TOR_EXIT_NODE_LIST_NAME = "tor_exit_nodes";

import Cache from "file-system-cache";

const cache = Cache({
  basePath: "./.cache",
  ns: "firewall",
  hash: "sha1",
  ttl: 60 * 60,
});

/**
 * Attempts to find an existing tor exit node list within
 * the Cloudflare account
 */
async function findExistingCloudflareExitNodeList(): Promise<CloudflareList> {
  let response = await getAllLists();

  if (!response.success) {
    throw JSON.stringify(response.errors);
  }

  let targetCloudflareList = response.result.find((list) => {
    return list.name == TOR_EXIT_NODE_LIST_NAME && list.kind == "ip";
  });

  return targetCloudflareList;
}

/**
 * Look for an existing exit node list within Cloudflare.
 * When the target list doesn't exist, use the Cloudflare api
 * to create a new type of ip address list.
 */
async function createCloudflareExitNodeList(): Promise<CloudflareList> {
  let response = await createList(
    TOR_EXIT_NODE_LIST_NAME,
    "A list of all tor exit node ip addresses",
    "ip"
  );

  if (!response.success) {
    throw JSON.stringify(response.errors);
  }

  return response.result;
}

/**
 *
 * @param torExitNodeIpAddressList Array of ip addresses
 */
async function main(torExitNodeIpAddressList: ListIpItem[]): Promise<void> {
  /**
   * Find or create a new exist node list within Cloudflare
   */

  let targetCloudflareList: CloudflareList;

  try {
    targetCloudflareList =
      (await findExistingCloudflareExitNodeList()) || (await createCloudflareExitNodeList());

    if (!targetCloudflareList) {
      throw "No data was returned from cloudflare";
    }
  } catch (err) {
    console.log("Could not find or create the tor exit node list on Cloudflare", err);
    return;
  }

  let res = await updateIpListItems(targetCloudflareList.id, torExitNodeIpAddressList);

  if (!res.success) {
    console.log("Failed to update the tor exit node list");
    console.log(JSON.stringify(res.errors));
    return;
  }

  console.log(
    "Tor exit node list is updating with " + torExitNodeIpAddressList.length + " addresses"
  );
}

const EXIT_NODE_SOURCES = [
  "https://www.dan.me.uk/torlist/?exit",
  "https://www.dan.me.uk/torlist/?entry",
  "https://check.torproject.org/torbulkexitlist",
  "https://raw.githubusercontent.com/SecOps-Institute/Tor-IP-Addresses/master/tor-exit-nodes.lst",
];

const cachedGetRequest = async (url): Promise<string> => {
  let pageContent;

  /**
   * Look for the requested page inside of the cache
   */

  pageContent = cache.getSync(url);

  if (pageContent) {
    console.log(`Request to ${url} was found in the cache`);

    return pageContent;
  } else {
    console.log(`${url} is not cached`);
  }

  pageContent = await fetch(url)
    .then((res) => res.text())
    .then((content) => content);

  /**
   * Add the page contents to the cache
   */
  cache.setSync(url, pageContent);

  console.log(`Request to ${url} has been cached`);

  return pageContent;
};

async function init(): Promise<void> {
  const schema = {
    type: "array",
    items: {
      type: "string",
      oneOf: [{ format: "ipv4" }, { format: "ipv6" }],
    },
  };

  /**
   * Get a list of all Tor exit nodes.
   */

  let torExitNodeList: ListIpItem[] = [];

  let addressList: string[] = [];

  for (let url of EXIT_NODE_SOURCES) {
    try {
      /**
       * Request the page content
       */
      let pageContent = await cachedGetRequest(url);

      /**
       * Remove all blank lines
       */
      let pageLines = pageContent
        .trim()
        .split("\n")
        .filter((line) => {
          return line.trim().length > 0;
        });

      const listIsValid = ajv.validate(schema, pageLines);

      if (!listIsValid) {
        console.log(
          `The ip address list from ${url} contains one or more non-conforming IPv4 or IPv6 addresses. Skipping`
        );
        continue;
      }
      addressList.push(...pageLines);
    } catch (err) {
      console.log("Failed to retreive a list of exit nodes from source: ", url);
      console.log(err);
    }
  }

  let convertedAddressList = addressList.map((ip) => {
    /**
     * Convert IPv6 addresses into CIDR notation
     */
    if (ip.includes(":")) {
      return ip.slice(0, 19) + "::/64";
    }
    return ip;
  });

  torExitNodeList = Array.from(new Set(convertedAddressList)).map((ip) => {
    return { ip };
  });

  if (torExitNodeList.length === 0) {
    console.log("Failed to retrieve an ip address list from all available sources. Quitting");
    return;
  }

  console.log(`Loaded ${torExitNodeList.length} ip addresses from all available sources`);

  /**
   * Update the Cloudflare Tor exit node list
   */
  main(torExitNodeList);
}

init();
