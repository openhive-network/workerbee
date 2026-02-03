# Blog Logic

Blog Logic is a library that makes getting, keeping and preparing Hive's data for blogging much simpler process. You can use logical, carefully prepared interfaces to handle the blog data you need, like posts, replies, accounts and other.

### Technical requirement

Because in the future development we plan using the Workerbee for getting data, it's part of Workerbee's repo. Other things necessary for functionality of this library is Wax for data fetching.

### Current data entities

* Comments - parent class for both Posts and Replies.
* Posts - an equivalent of real live blog post, not a reply for any existing one.
* Reply - in nested structure. It can be a direct reply to other reply. We keep identification of top post for any Reply.
* Vote - representation of single vote for given comment.
* Community - for Hive's community with its details.
* Account - details about an user or the author of given post.

### Data Provider

The class to feed all the other classes with data is Data Provider. Its implementation is necessary for proper working of the rest of classes. It is responsible for fetching and caching all the data required by other entities. Then they can ask Data Provider for data and map then into their own interfaces.

The implementation of Data Provider is quite elastic. In the future we're going to use Workerbee there and some system to cache data in a better way.

### How to use

1. Import files or interfaces you want to use. You can just start with current version of Data Provider.
2. Create new object of Data Provider class, putting Wax's chain into contructor.
3. Use Data Provider's Blogging Platform class to get any data you want, preprepared for the nice, logical interface. You can call their methods and they'll help you with managing blog data.

