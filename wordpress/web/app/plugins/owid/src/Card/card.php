<?php

namespace OWID\blocks\card;

function render($attributes, $content)
{
    $classes = 'wp-block-owid-card ';

    $title = null;
    if (!empty($attributes['title'])) {
        $title = "<h3>{$attributes['title']}</h3>";
    }

    $linkStart = $linkEnd = null;
    $isGrapher = null;
    if (!empty($attributes['linkUrl'])) {
        $isGrapher =
            substr(parse_url($attributes['linkUrl'], PHP_URL_PATH), 0, 9) ===
            '/grapher/';
        $target_blank = $isGrapher ? ' target="_blank"' : null;
        $linkStart =
            '<a href="' .
            esc_url($attributes['linkUrl']) .
            '"' .
            $target_blank .
            '>';
        $linkEnd = '</a>';
    }

    $img = null;
    if (!empty($attributes['mediaUrl'])) {
        $img = wp_get_attachment_image($attributes['mediaId'], 'medium_large');
    } else {
        if ($isGrapher) {
            $pathElements = explode(
                "/",
                parse_url($attributes['linkUrl'], PHP_URL_PATH)
            );
            $chartSlug = end($pathElements);
            $img = '<img src="/grapher/exports/' . $chartSlug . '.svg" />';
        }
    }

    $figure = null;
    if ($img) {
        $figure = "<figure>" . $img . "</figure>";
        $classes .= ' with-image';
    }

    $block = <<<EOD
      <div class="$classes" data-no-lightbox>
        $linkStart
            $figure
            <div class="content-wrapper">
              $title
              <div class="content">
                $content
              </div>
            </div>
        $linkEnd
      </div>
EOD;

    return $block;
}
