<?php
/**
 *  PaginationHelper — стандартный payload пагинации 
 *
 * НАЗНАЧЕНИЕ:
 * Общая сборка API-ответа пагинированных списков в формате
 * `{ items, total_count, page, per_page, total_pages }`.
 */


function build_pagination_payload(
    array $items,
    int $total_count,
    int $page,
    int $per_page,
    bool $empty_page_as_one = false
): array {
    if ($per_page <= 0) {
        $total_pages = 1;
    } elseif ($total_count > 0) {
        $total_pages = (int) ceil($total_count / $per_page);
    } else {
        $total_pages = $empty_page_as_one ? 1 : 0;
    }

    return [
        'items'       => $items,
        'total_count' => $total_count,
        'page'        => $page,
        'per_page'    => $per_page,
        'total_pages' => $total_pages,
    ];
}
