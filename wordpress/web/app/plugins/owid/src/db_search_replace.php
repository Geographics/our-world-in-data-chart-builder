<?php
// Run this script as a logged-in user otherwise the revisions are created with author "O"
// If using wp eval-file, pass "--user=[USER_ID]" flag
// todo: reinstall wp-cli on local? https://github.com/owid/owid-grapher/issues/1249
// e.g. $ lando wp eval-file --user=35 /path/to/script.php
//
// Check out the following commits for examples:
// - Add all publication contexts to current posts 2dac1c851080227cd102759e33d64b760b893f6b
// - remove_has_2_columns.php 042355f7fc8d3aab663656e7259f71446e9eb7f2
// - h5_to_h4.php 5b5b7b1e9caa2c631a4684506525618730088143
// - format_wpautop.php 4b70d7557fb31882e63957777a72a62d6906e0ec
?>

<?php
function get_post_admin_links($post)
{
    $name = $post->post_title;
    $view = "https://ourworldindata.org/$post->post_name";
    $preview = "https://owid.cloud/admin/posts/preview/$post->ID";
    $edit = "https://owid.cloud/wp/wp-admin/post.php?post=$post->ID&action=edit";
    // $view = "http://localhost:3099/$post->post_name";
    // $edit = "http://owid.lndo.site/wp/wp-admin/post.php?post=$post->ID&action=edit";

    return "$name ; $view ; $preview ; $edit";
}

$posts = get_posts([
    'post_type' => ['post', 'page', 'wp_block'],
    'numberposts' => -1,
]); //, 'include' => array(26199, 596)));

foreach ($posts as $post) {
    $content = $post->post_content;

    // Add regex here (e.g. "/dog/")
    $patterns = [];

    // Add replacement strings here (e.g. "cat")
    $replacements = [];

    $nb_replacements = 0;
    $content = preg_replace(
        $patterns,
        $replacements,
        $content,
        -1,
        $nb_replacements
    );

    if ($nb_replacements !== 0) {
        echo get_post_admin_links($post) . "\n";

        $my_post = [
            'ID' => $post->ID,
            // necessary to prevent "un-slashing" attributes JSON encoded by setAttributes (see ProminentLink.js, RichText)
            // https://github.com/WordPress/gutenberg/blob/master/packages/escape-html/src/index.js#L60
            // Without this unicode characters \u003c ("<"), \u003e (">"), \u0026 ("&") get stripped of their backslash and "u003c" is shown on the front-end.
            'post_content' => wp_slash($content),
        ];

        // IMPORTANT: comment out post_updated hook in owid.php before uncommenting this (DB will crash otherwise)
        // wp_update_post($my_post);
    }
}

