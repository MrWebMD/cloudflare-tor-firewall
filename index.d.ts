interface CloudflareList {
  id: string;
  name: string;
  kind: string;
  description?: string;
  num_items: number;
  num_referencing_filters: number;
  created_on: string;
  modified_on: string;
}
interface ApiResponse<T> {
  result: T;
  success: boolean;
  errors: string[];
  messages: string[];
}

interface ListIpItem {
  ip: string;
}
