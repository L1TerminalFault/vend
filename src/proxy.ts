import { createRouteMatcher, clerkMiddleware } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher(["/order"]);
const isApiRoute = createRouteMatcher(["/api(.*)"]);

export default clerkMiddleware(async (auth, req) => {
	// API routes handle auth in their own handlers (GET returns empty data when signed out)
	// if (isApiRoute(req)) return;

	if (!isPublicRoute(req)) {
		await auth.protect();
	}
});

export const config = {
	matcher: [
		"/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
		"/(api|trpc)(.*)",
	],
};
