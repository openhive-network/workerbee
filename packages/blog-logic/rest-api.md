// Work in progress

# POSTS

GET posts?(filters, pagination)
GET posts/{post-id}
POST posts
PUT posts/{post-id}
DELETE posts/{post-id}
GET posts/{post-id}/comments?(filters, pagination)
GET posts/{post-id}/comments/{comment-id}
POST posts/{post-id}/comments
PUT posts/{post-id}/comments/{comment-id}
DELETE posts/{post-id}/comments/{comment-id}
POST posts/{post-id}/vote

# USER

GET users/{user-id}/profile
GET users/{user-id}/posts?(filters, pagination)

# COMMUNITY

GET communities/{community-id}/profile
GET communities/{community-id}/posts?(filters, pagination)
