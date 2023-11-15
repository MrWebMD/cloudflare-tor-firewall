/**
 * Get an array of all lists currently stored within the Cloudflare account.
 */
export async function getAllLists(): Promise<ApiResponse<CloudflareList[]>> {
  return await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID!}/rules/lists`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CF_API_KEY!}`,
      },
    }
  ).then((res) => res.json());
}

/**
 *
 * @param name The name of your list consisting of uppercase and lowercase letters, numbers, and underscores.
 * @param description An optional comment to help describe your list within cloudflare.
 * @param kind Must be equal to "ip"
 * @returns
 */
export async function createList(
  name: string,
  description: string,
  kind: "ip"
): Promise<ApiResponse<CloudflareList>> {
  return await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID!}/rules/lists`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CF_API_KEY!}`,
      },
      body: JSON.stringify({
        name,
        description,
        kind,
      }),
    }
  ).then((res) => res.json());
}

/**
 * Remove all current items from the list, and replace it with new list items.
 * @param listId The unique id of the list within cloudflare. Ex. 2c0fc9fa937b11eaa1b71c4d701ab86e
 * @param ipList An array of objects which have a key called "ip". Each entry corressponds to a ip address on the list.
 * @returns
 */
export async function updateIpListItems(
  listId: string,
  ipList: ListIpItem[]
): Promise<ApiResponse<{ operation_id: string }>> {
  return await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${process.env
      .CF_ACCOUNT_ID!}/rules/lists/${listId}/items`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CF_API_KEY!}`,
      },
      body: JSON.stringify(ipList),
    }
  ).then((res) => res.json());
}
