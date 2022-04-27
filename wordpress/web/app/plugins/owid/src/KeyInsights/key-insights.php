<?php

namespace OWID\blocks\key_insights;

function render($attributes, $content)
{
    $block = <<<EOD
	<block type="key-insights">
		<content>$content</content>
	</block>
EOD;

    return $block;
}
