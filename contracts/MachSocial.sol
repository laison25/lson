// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Only the social contract that created this token can mint rewards.
contract MachToken is ERC20 {
    address public immutable social;
    error OnlySocial();

    constructor() ERC20("Lson Token", "LSON") { social = msg.sender; }

    function reward(address author, uint256 amount) external {
        if (msg.sender != social) revert OnlySocial();
        _mint(author, amount);
    }
}

/// @notice Content lives on IPFS; authorship, likes and rewards live on-chain.
/// A unique wallet is not proof of a unique human (no Sybil resistance).
contract MachSocial {
    struct Post {
        uint256 id;
        address author;
        string cid;
        uint256 createdAt;
        uint256 likes;
        bool rewarded;
    }

    uint256 public constant LIKE_THRESHOLD = 5;
    uint256 public constant REWARD_AMOUNT = 10 ether;
    uint256 public postCount;
    MachToken public immutable token;
    mapping(uint256 => Post) private posts;
    mapping(uint256 => mapping(address => bool)) public hasLiked;
    mapping(address => uint256) public rewardsEarned;
    mapping(address => uint256[]) private authorPosts;

    error InvalidCID();
    error PostNotFound();
    error SelfLike();
    error AlreadyLiked();
    error InvalidPage();

    event PostCreated(uint256 indexed id, address indexed author, string cid, uint256 createdAt);
    event PostLiked(uint256 indexed id, address indexed liker, uint256 likes);
    event PostRewarded(uint256 indexed id, address indexed author, uint256 amount);

    constructor() { token = new MachToken(); }

    function createPost(string calldata cid) external returns (uint256 id) {
        // This application accepts only 59-character lowercase base32 CIDv1 dag-pb CIDs
        // produced by Kubo with cid-version=1 (sha2-256).
        bytes memory value = bytes(cid);
        if (value.length != 59) revert InvalidCID();
        if (value[0] != 'b' || value[1] != 'a' || value[2] != 'f' || value[3] != 'y') revert InvalidCID();
        for (uint256 i; i < value.length; ++i) {
            bytes1 c = value[i];
            if (!((c >= 'a' && c <= 'z') || (c >= '2' && c <= '7'))) revert InvalidCID();
        }
        id = ++postCount;
        posts[id] = Post(id, msg.sender, cid, block.timestamp, 0, false);
        authorPosts[msg.sender].push(id);
        emit PostCreated(id, msg.sender, cid, block.timestamp);
    }

    function likePost(uint256 id) external {
        Post storage post = posts[id];
        if (post.id == 0) revert PostNotFound();
        if (post.author == msg.sender) revert SelfLike();
        if (hasLiked[id][msg.sender]) revert AlreadyLiked();
        hasLiked[id][msg.sender] = true;
        ++post.likes;
        emit PostLiked(id, msg.sender, post.likes);
        if (post.likes == LIKE_THRESHOLD && !post.rewarded) {
            post.rewarded = true;
            rewardsEarned[post.author] += REWARD_AMOUNT;
            token.reward(post.author, REWARD_AMOUNT);
            emit PostRewarded(id, post.author, REWARD_AMOUNT);
        }
    }

    function getPost(uint256 id) external view returns (Post memory) {
        if (posts[id].id == 0) revert PostNotFound();
        return posts[id];
    }

    /// @notice Newest first. Offset is the number of newest posts already read.
    function getPosts(uint256 offset, uint256 limit) external view returns (Post[] memory page) {
        if (limit == 0 || limit > 50) revert InvalidPage();
        if (offset >= postCount) return new Post[](0);
        uint256 size = postCount - offset;
        if (size > limit) size = limit;
        page = new Post[](size);
        for (uint256 i; i < size; ++i) page[i] = posts[postCount - offset - i];
    }

    function authorPostCount(address author) external view returns (uint256) {
        return authorPosts[author].length;
    }

    function getAuthorPosts(address author, uint256 offset, uint256 limit) external view returns (Post[] memory page) {
        if (limit == 0 || limit > 50) revert InvalidPage();
        uint256 count = authorPosts[author].length;
        if (offset >= count) return new Post[](0);
        uint256 size = count - offset;
        if (size > limit) size = limit;
        page = new Post[](size);
        for (uint256 i; i < size; ++i) page[i] = posts[authorPosts[author][count - offset - i - 1]];
    }
}
