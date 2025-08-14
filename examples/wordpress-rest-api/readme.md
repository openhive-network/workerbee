# Hive to WordPress example

This project maps data from Hive and returns it as proper WordPress API. It will be later use by custom front end (like Frontity) to display posts and comments.

### Instalation

* Get project and get submodules.
* Go into `example/wordpress-rest-api`.
* `pnpm install`.
* Change `example-config.ts` file to get the data you want to see on main page.
* `pnpm run dev` for deployment. Rest API should be ready to work with your front end.

### About

This example is still a work in progress. It was made to be used with Frontity especially, but the API can connect to other part of WordPress infrastructure.

Tags, categories and authors are off so far. The things you can do with this API is to display posts list, single posts and comments for given post.