import { Meta, Title } from '@solidjs/meta';
import { A, Route, Router } from '@solidjs/router';
import type { Component } from 'solid-js';

// Home page component
const Home: Component = () => {
	return (
		<div>
			<Title>Home - Solid Example</Title>
			<Meta name="description" content="Home page of the Solid example app" />
			<h1>Welcome to the Home Page</h1>
			<p>This is the home page of our minimal Solid.js example.</p>
			<nav>
				<ul>
					<li>
						<A href="/">Home</A>
					</li>
					<li>
						<A href="/blog">Blog</A>
					</li>
				</ul>
			</nav>
		</div>
	);
};

// Blog list page component
const BlogList: Component = () => {
	const blogPosts = [
		{ id: 1, title: 'First Blog Post', excerpt: 'This is the first blog post...' },
		{ id: 2, title: 'Second Blog Post', excerpt: 'This is the second blog post...' },
		{ id: 3, title: 'Third Blog Post', excerpt: 'This is the third blog post...' },
	];

	return (
		<div>
			<Title>Blog - Solid Example</Title>
			<Meta name="description" content="Blog list page" />
			<h1>Blog Posts</h1>
			<nav>
				<ul>
					<li>
						<A href="/">Home</A>
					</li>
					<li>
						<A href="/blog">Blog</A>
					</li>
				</ul>
			</nav>
			<div>
				{blogPosts.map(post => (
					<article>
						<h2>
							<A href={`/blog/${post.id}`}>{post.title}</A>
						</h2>
						<p>{post.excerpt}</p>
					</article>
				))}
			</div>
		</div>
	);
};

// Blog content page component
const BlogPost: Component = (props: any) => {
	const blogData = {
		1: {
			title: 'First Blog Post',
			content:
				'This is the full content of the first blog post. Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
		},
		2: {
			title: 'Second Blog Post',
			content:
				'This is the full content of the second blog post. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
		},
		3: {
			title: 'Third Blog Post',
			content:
				'This is the full content of the third blog post. Ut enim ad minim veniam, quis nostrud exercitation ullamco.',
		},
	};

	const postId = props.params.id;
	const post = blogData[postId as keyof typeof blogData];

	if (!post) {
		return (
			<div>
				<Title>Post Not Found - Solid Example</Title>
				<h1>Post Not Found</h1>
				<p>The blog post you're looking for doesn't exist.</p>
				<nav>
					<ul>
						<li>
							<A href="/">Home</A>
						</li>
						<li>
							<A href="/blog">Blog</A>
						</li>
					</ul>
				</nav>
			</div>
		);
	}

	return (
		<div>
			<Title>{post.title} - Solid Example</Title>
			<Meta name="description" content={`Blog post: ${post.title}`} />
			<nav>
				<ul>
					<li>
						<A href="/">Home</A>
					</li>
					<li>
						<A href="/blog">Blog</A>
					</li>
				</ul>
			</nav>
			<article>
				<h1>{post.title}</h1>
				<p>{post.content}</p>
			</article>
		</div>
	);
};

const App: Component = () => {
	return (
		<Router>
			<Route path="/" component={Home} />
			<Route path="/blog" component={BlogList} />
			<Route path="/blog/:id" component={BlogPost} />
		</Router>
	);
};

export default App;
