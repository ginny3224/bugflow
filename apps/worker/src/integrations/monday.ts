/**
 * BugFlow Worker – Monday.com API Client
 * Minimal GraphQL client for creating and reading items on a Monday.com board.
 */

const MONDAY_API_URL = 'https://api.monday.com/v2';
const MONDAY_API_VERSION = '2024-01';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MondayColumnValues {
  [columnId: string]: string | number | Record<string, unknown>;
}

export interface MondayItem {
  id: string;
  name: string;
  board: { id: string };
  column_values: Array<{ id: string; text: string; value: string }>;
}

interface MondayCreateItemResponse {
  data: {
    create_item: {
      id: string;
      name: string;
    };
  };
  errors?: Array<{ message: string }>;
}

interface MondayGetItemsResponse {
  data: {
    boards: Array<{
      items_page: {
        cursor: string | null;
        items: MondayItem[];
      };
    }>;
  };
  errors?: Array<{ message: string }>;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function mondayGraphQL<T>(
  apiKey: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: apiKey,
      'API-Version': MONDAY_API_VERSION,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '(no body)');
    throw new Error(`Monday.com API HTTP ${response.status}: ${text.slice(0, 300)}`);
  }

  const json = (await response.json()) as T & { errors?: Array<{ message: string }> };

  if ('errors' in json && Array.isArray(json.errors) && json.errors.length > 0) {
    const messages = json.errors.map((e) => e.message).join('; ');
    throw new Error(`Monday.com GraphQL errors: ${messages}`);
  }

  return json;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a new item on a Monday.com board.
 *
 * @param apiKey     Monday.com API token
 * @param boardId    Numeric board ID as a string
 * @param itemName   Name / title of the item
 * @param columnValues  Column ID → value map. Values must be JSON-stringified per Monday.com spec.
 * @returns The created item's Monday.com ID
 */
export async function createItem(
  apiKey: string,
  boardId: string,
  itemName: string,
  columnValues: MondayColumnValues,
): Promise<string> {
  const columnValuesJson = JSON.stringify(
    Object.fromEntries(
      Object.entries(columnValues).map(([k, v]) => [
        k,
        typeof v === 'string' ? v : JSON.stringify(v),
      ]),
    ),
  );

  const mutation = `
    mutation CreateItem($boardId: ID!, $itemName: String!, $columnValues: JSON!) {
      create_item(
        board_id: $boardId
        item_name: $itemName
        column_values: $columnValues
      ) {
        id
        name
      }
    }
  `;

  const result = await mondayGraphQL<MondayCreateItemResponse>(apiKey, mutation, {
    boardId,
    itemName,
    columnValues: columnValuesJson,
  });

  const itemId = result.data?.create_item?.id;
  if (!itemId) {
    throw new Error('Monday.com create_item did not return an item ID');
  }

  return itemId;
}

/**
 * Fetch items from a Monday.com board with optional cursor-based pagination.
 *
 * @param apiKey   Monday.com API token
 * @param boardId  Numeric board ID as a string
 * @param cursor   Pagination cursor from a previous call, or undefined for the first page
 * @returns Items and the next cursor (null if last page)
 */
export async function getItems(
  apiKey: string,
  boardId: string,
  cursor?: string,
): Promise<{ items: MondayItem[]; nextCursor: string | null }> {
  const query = `
    query GetItems($boardId: ID!, $cursor: String) {
      boards(ids: [$boardId]) {
        items_page(limit: 50, cursor: $cursor) {
          cursor
          items {
            id
            name
            board { id }
            column_values {
              id
              text
              value
            }
          }
        }
      }
    }
  `;

  const result = await mondayGraphQL<MondayGetItemsResponse>(apiKey, query, {
    boardId,
    cursor: cursor ?? null,
  });

  const board = result.data?.boards?.[0];
  if (!board) {
    throw new Error(`Monday.com board ${boardId} not found or not accessible`);
  }

  return {
    items: board.items_page.items,
    nextCursor: board.items_page.cursor,
  };
}
