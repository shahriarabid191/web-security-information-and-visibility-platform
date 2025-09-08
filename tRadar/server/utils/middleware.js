// Use later to protect analyst-only pages
export function requireAnalyst(req, res, next) {
  if (req.session?.user && req.session.user.uRole === "Analyst") return next();
  return res.redirect("/login.html");
}
