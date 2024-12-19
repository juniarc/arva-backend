from flask import jsonify, request, Blueprint
from models.wishlist import Wishlist
from models.users import User
from models.products import Product
from models.discount import Discount
from models.variant import Variant
from models.image_product import ImageProduct
from models.rating import Rating
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from connector.db import db



wishlist_bp= Blueprint('wishlist_controller', __name__)


@wishlist_bp.route('/allwishlist', methods=['GET'])
def get_all_wishlist():
    try:
        wishlist = db.session.query(Wishlist).all()

        return jsonify([w.to_dict() for w in wishlist]), 200
    except Exception as e:
        return jsonify({'error': f'Failed to get wishlist {e}'}), 500
    
@wishlist_bp.route('/getwishlistbyid/<int:wishlist_id>', methods=['GET'])
def get_wishlist_by_id(wishlist_id):
    try:
        wishlist = db.session.query(Wishlist).filter_by(wishlist_id=wishlist_id).first()
        if wishlist is None:
            return jsonify({'error': 'Wishlist not found'}), 404

        return jsonify(wishlist.to_dict()), 200
    except Exception as e:
        return jsonify({'error': f'Failed to get wishlist {e}'}), 500

@wishlist_bp.route('/getwishlistuser/<int:user_id>', methods=['GET'])
def get_wishlist_user(user_id):
    product_list = []
    variant_list = []
    image_list = []
    discount_list = []
    try:
        user_wishlist = db.session.query(Wishlist).filter_by(user_id=user_id).all()

        for w in user_wishlist:
            product = db.session.query(Product).filter_by(product_id=w.product_id).first()
            shop_id = product.shop.shop_id
            shop_name = product.shop.shop_name
            shop_address_city = product.shop.shop_address_city
            category_name = product.category.category_name
            discounts = db.session.query(Discount).filter_by(product_id=w.product_id).all()
            variants = db.session.query(Variant).filter_by(product_id=w.product_id).all()
            images = db.session.query(ImageProduct).filter_by(product_id=w.product_id).all()
            ratings = db.session.query(db.func.avg(Rating.rating_product)).filter_by(product_id=product.product_id).scalar()

            for discount in discounts:
                discount_list.append(discount.to_dict())

            for image in images:
                image_list.append(image.to_dict())
            
            for variant in variants:
                variant_list.append(variant.to_dict())

            product_list.append({
                'product_id': product.product_id,
                'product_name': product.product_name,
                'description': product.description,
                'product_type': product.product_type,
                'shipping_cost': product.shipping_cost,
                'sold': product.sold,
                'status': product.status,
                'shop': {                
                    'shop_id': shop_id,
                    'shop_name': shop_name,
                    'shop_address_city': shop_address_city
                    },
                'category_name': category_name,
                'discount': discount_list,
                'variant': variant_list,
                'image': image_list,
                'rating': ratings
            })
        
        return jsonify(product_list), 200       
    except Exception as e:
        return jsonify({'error': f'Failed to get wishlist {e}'}), 500

@wishlist_bp.route('/addwishlist', methods=['POST'])
@jwt_required()
def add_wishlist():
    data = request.get_json()
    current_user_id = int(get_jwt_identity())
    
    if data is None:
        return jsonify({'error': 'No data provided'}), 400
    elif 'product_id' not in data or not data['product_id']:
        return jsonify({'error': 'Missing product id'}), 400


    try:
        user = db.session.query(User).filter_by(user_id=current_user_id).first()
        if user is None:
            return jsonify({'error': 'User not found'}), 404

        product = db.session.query(Product).filter_by(product_id=data['product_id']).first()
        if product is None:
            return jsonify({'error': 'Product not found'}), 404

        wishlist = Wishlist(user_id=current_user_id, product_id=data['product_id'])
        db.session.add(wishlist)
        db.session.commit()

        return jsonify({
            'message': 'Product added to wishlist successfully',
            'wishlist': wishlist.to_dict()}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to add product to wishlist {e}'}), 500

@wishlist_bp.route('/deletewishlist/<int:wishlist_id>', methods=['DELETE'])
def delete_wishlist(wishlist_id):
    try:
        wishlist = db.session.query(Wishlist).filter_by(wishlist_id=wishlist_id).first()
        if wishlist is None:
            return jsonify({'error': 'Wishlist not found'}), 404

        db.session.delete(wishlist)
        db.session.commit()

        return jsonify({'message': 'Product removed from wishlist successfully'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to remove product from wishlist {e}'}), 500
        
 